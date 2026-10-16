package expo.modules.filepreviews

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class NoFrameException : CodedException("The video has no frame to show")

class PdfOpenException(cause: Throwable) :
  CodedException("The PDF couldn't be opened", cause)

// the largest side of a video frame, matching the server's image thumbnails
private const val FRAME_SIZE = 640

// keeps a page bitmap well under Android's 100 MB drawing limit
private const val MAX_PAGE_PIXELS = 4096 * 4096

private fun pathOf(location: String): String {
  val uri = Uri.parse(location)
  return if (uri.scheme == "file") uri.path ?: location else location
}

private fun Bitmap.writeJpeg(target: String, quality: Int) {
  val file = File(pathOf(target))
  file.parentFile?.mkdirs()
  // written aside and renamed, so a reader never sees half a file
  val temp = File(file.parentFile, "${file.name}.tmp")
  temp.outputStream().use { compress(Bitmap.CompressFormat.JPEG, quality, it) }
  if (!temp.renameTo(file)) {
    temp.delete()
    throw CodedException("Couldn't write $target")
  }
}

class FilePreviewsModule : Module() {
  // pdfium isn't thread-safe, so every PDF call takes turns on one renderer
  private val pdfLock = Mutex()
  private var openPdf: Pair<String, PdfRenderer>? = null

  private fun renderer(path: String): PdfRenderer {
    openPdf?.let { (openPath, renderer) ->
      if (openPath == path) return renderer
      renderer.close()
    }
    openPdf = null

    val renderer = try {
      PdfRenderer(ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY))
    } catch (error: Exception) {
      throw PdfOpenException(error)
    }
    openPdf = path to renderer
    return renderer
  }

  override fun definition() = ModuleDefinition {
    Name("FilePreviews")

    OnDestroy {
      openPdf?.second?.close()
      openPdf = null
    }

    AsyncFunction("videoFrame") Coroutine { url: String, headers: Map<String, String>, target: String ->
      withContext(Dispatchers.IO) {
        val retriever = MediaMetadataRetriever()
        try {
          retriever.setDataSource(url, headers)

          val duration = retriever
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            ?.toLongOrNull() ?: 0L
          val storedWidth = retriever
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
            ?.toIntOrNull() ?: 0
          val storedHeight = retriever
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
            ?.toIntOrNull() ?: 0
          val rotation = retriever
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
            ?.toIntOrNull() ?: 0
          // frames come back upright, so a portrait recording swaps its sides
          val sideways = rotation % 180 != 0
          val width = if (sideways) storedHeight else storedWidth
          val height = if (sideways) storedWidth else storedHeight
          // an audio-only file has no frame to show
          if (width <= 0 || height <= 0) throw NoFrameException()

          val scale = min(1.0, FRAME_SIZE.toDouble() / max(width, height))
          val frameWidth = (width * scale).roundToInt().coerceAtLeast(1)
          val frameHeight = (height * scale).roundToInt().coerceAtLeast(1)

          // a tenth of a second in, like the web's `#t=0.1`
          val time = 100_000L
          val option = MediaMetadataRetriever.OPTION_CLOSEST_SYNC
          val frame = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            retriever.getScaledFrameAtTime(time, option, frameWidth, frameHeight)
          } else {
            retriever.getFrameAtTime(time, option)?.let {
              Bitmap.createScaledBitmap(it, frameWidth, frameHeight, true)
            }
          } ?: throw NoFrameException()

          frame.writeJpeg(target, 80)
          mapOf(
            "width" to frame.width,
            "height" to frame.height,
            "duration" to duration / 1000.0
          ).also { frame.recycle() }
        } finally {
          retriever.release()
        }
      }
    }

    AsyncFunction("pdfInfo") Coroutine { path: String ->
      withContext(Dispatchers.IO) {
        pdfLock.withLock {
          val renderer = renderer(pathOf(path))
          val pages = (0 until renderer.pageCount).map { index ->
            renderer.openPage(index).use { page ->
              mapOf("width" to page.width, "height" to page.height)
            }
          }
          mapOf("pages" to pages)
        }
      }
    }

    AsyncFunction("pdfPage") Coroutine { path: String, index: Int, width: Int, target: String ->
      withContext(Dispatchers.IO) {
        pdfLock.withLock {
          val renderer = renderer(pathOf(path))
          if (index < 0 || index >= renderer.pageCount) {
            throw CodedException("The PDF has no page ${index + 1}")
          }

          renderer.openPage(index).use { page ->
            var bitmapWidth = width.coerceAtLeast(1)
            var bitmapHeight = (bitmapWidth.toDouble() * page.height / page.width).roundToInt()
            val pixels = bitmapWidth.toLong() * bitmapHeight
            if (pixels > MAX_PAGE_PIXELS) {
              val shrink = Math.sqrt(MAX_PAGE_PIXELS.toDouble() / pixels)
              bitmapWidth = (bitmapWidth * shrink).roundToInt()
              bitmapHeight = (bitmapHeight * shrink).roundToInt()
            }
            bitmapHeight = bitmapHeight.coerceAtLeast(1)

            val bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888)
            // pages are transparent where nothing is drawn
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            bitmap.writeJpeg(target, 90)
            bitmap.recycle()

            mapOf("width" to bitmapWidth, "height" to bitmapHeight)
          }
        }
      }
    }
  }
}
