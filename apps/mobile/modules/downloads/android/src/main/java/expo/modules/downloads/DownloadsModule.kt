package expo.modules.downloads

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class SaveException(message: String) : CodedException(message)

class DownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Downloads")

    // copies a finished download into the shared Downloads folder, like a browser
    AsyncFunction("save") Coroutine { path: String, name: String, mimeType: String ->
      withContext(Dispatchers.IO) { save(path, name, mimeType) }
    }
  }

  private fun save(path: String, name: String, mimeType: String): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw SaveException("Saving to Downloads needs Android 10")
    }
    val resolver = appContext.reactContext?.contentResolver
      ?: throw Exceptions.ReactContextLost()
    val source = Uri.parse(path).path?.let(::File) ?: File(path)

    val pending = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, name)
      put(MediaStore.Downloads.MIME_TYPE, mimeType)
      put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
      put(MediaStore.Downloads.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, pending)
      ?: throw SaveException("Couldn't create the file in Downloads")

    try {
      val output = resolver.openOutputStream(uri)
        ?: throw SaveException("Couldn't write to Downloads")
      output.use { out -> source.inputStream().use { it.copyTo(out) } }
      resolver.update(
        uri,
        ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
        null,
        null,
      )
    } catch (error: Throwable) {
      resolver.delete(uri, null, null)
      throw error
    }

    // MediaStore renames the file when Downloads already has one by that name
    return resolver
      .query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)
      ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
      ?: name
  }
}
