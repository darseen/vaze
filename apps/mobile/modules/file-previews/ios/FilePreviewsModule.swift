import AVFoundation
import ExpoModulesCore
import PDFKit
import UIKit

// the largest side of a video frame, matching the server's image thumbnails
private let frameSize: CGFloat = 640

// keeps a page bitmap at a size the other platform also allows
private let maxPagePixels: CGFloat = 4096 * 4096

internal final class NoFrameException: Exception {
  override var reason: String { "The video has no frame to show" }
}

internal final class PdfOpenException: Exception {
  override var reason: String { "The PDF couldn't be opened" }
}

internal final class PdfPageException: GenericException<Int> {
  override var reason: String { "The PDF has no page \(param)" }
}

internal final class WriteException: GenericException<String> {
  override var reason: String { "Couldn't write \(param)" }
}

private func fileURL(_ location: String) -> URL {
  if let url = URL(string: location), url.isFileURL {
    return url
  }
  return URL(fileURLWithPath: location)
}

private func writeJpeg(_ image: UIImage, to target: String, quality: CGFloat) throws {
  let url = fileURL(target)
  guard let data = image.jpegData(compressionQuality: quality) else {
    throw WriteException(target)
  }
  try FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  try data.write(to: url, options: .atomic)
}

/// The page's size in points with its rotation applied.
private func uprightSize(of page: PDFPage) -> CGSize {
  let size = page.bounds(for: .cropBox).size
  return page.rotation % 180 == 0 ? size : CGSize(width: size.height, height: size.width)
}

public final class FilePreviewsModule: Module {
  private let pdfQueue = DispatchQueue(label: "dev.darseen.vaze.file-previews.pdf")
  private var openPdf: (path: String, document: PDFDocument)?

  private func document(_ path: String) throws -> PDFDocument {
    if let openPdf, openPdf.path == path {
      return openPdf.document
    }
    guard let document = PDFDocument(url: fileURL(path)), !document.isLocked else {
      throw PdfOpenException()
    }
    openPdf = (path, document)
    return document
  }

  public func definition() -> ModuleDefinition {
    Name("FilePreviews")

    AsyncFunction("videoFrame") { (url: URL, headers: [String: String], target: String) async throws -> [String: Any] in
      let asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": headers])
      // an audio-only file has no frame to show
      guard try await !asset.loadTracks(withMediaType: .video).isEmpty else {
        throw NoFrameException()
      }
      let duration = try await asset.load(.duration).seconds

      let generator = AVAssetImageGenerator(asset: asset)
      generator.appliesPreferredTrackTransform = true
      generator.maximumSize = CGSize(width: frameSize, height: frameSize)
      // a tenth of a second in, like the web's `#t=0.1`
      let (frame, _) = try await generator.image(at: CMTime(seconds: 0.1, preferredTimescale: 600))

      try writeJpeg(UIImage(cgImage: frame), to: target, quality: 0.8)
      return [
        "width": frame.width,
        "height": frame.height,
        "duration": duration.isFinite ? duration : 0
      ]
    }

    AsyncFunction("pdfInfo") { (path: String) throws -> [String: Any] in
      let document = try self.document(path)
      let pages = (0..<document.pageCount).compactMap { document.page(at: $0) }.map { page in
        let size = uprightSize(of: page)
        return ["width": Double(size.width), "height": Double(size.height)]
      }
      return ["pages": pages]
    }
    .runOnQueue(pdfQueue)

    AsyncFunction("pdfPage") { (path: String, index: Int, width: Int, target: String) throws -> [String: Any] in
      let document = try self.document(path)
      guard let page = document.page(at: index) else {
        throw PdfPageException(index + 1)
      }

      let pageSize = uprightSize(of: page)
      var size = CGSize(width: CGFloat(max(width, 1)), height: 1)
      size.height = max((size.width * pageSize.height / pageSize.width).rounded(), 1)
      let pixels = size.width * size.height
      if pixels > maxPagePixels {
        let shrink = (maxPagePixels / pixels).squareRoot()
        size = CGSize(width: (size.width * shrink).rounded(), height: (size.height * shrink).rounded())
      }

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: size))
        // PDF space grows upwards, UIKit's downwards
        let cg = context.cgContext
        cg.translateBy(x: 0, y: size.height)
        cg.scaleBy(x: size.width / pageSize.width, y: -size.height / pageSize.height)
        page.draw(with: .cropBox, to: cg)
      }

      try writeJpeg(image, to: target, quality: 0.9)
      return ["width": Int(size.width), "height": Int(size.height)]
    }
    .runOnQueue(pdfQueue)
  }
}
