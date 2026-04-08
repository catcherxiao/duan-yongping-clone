#!/usr/bin/env swift

import AppKit
import Foundation
import PDFKit
import Vision

struct Config {
    var input: String = ""
    var outputDir: String = "source-materials/notes/pdf-ocr"
    var startPage: Int = 1
    var endPage: Int?
    var dpi: Double = 180.0
    var combinedName: String = "combined.txt"
}

enum OCRError: Error, CustomStringConvertible {
    case invalidArguments(String)
    case cannotOpenPDF(String)
    case cannotRenderPage(Int)
    case cannotEncodeImage(Int)
    case recognitionFailed(Int, String)

    var description: String {
        switch self {
        case .invalidArguments(let message):
            return message
        case .cannotOpenPDF(let path):
            return "无法打开 PDF: \(path)"
        case .cannotRenderPage(let page):
            return "无法渲染第 \(page) 页"
        case .cannotEncodeImage(let page):
            return "无法生成第 \(page) 页位图"
        case .recognitionFailed(let page, let message):
            return "第 \(page) 页 OCR 失败: \(message)"
        }
    }
}

func printUsage() {
    let text = """
    Usage:
      swift scripts/ocr_pdf_vision.swift --input <pdf> [--output-dir <dir>] [--start-page 1] [--end-page 20] [--dpi 180]
    """
    print(text)
}

func parseArgs() throws -> Config {
    var config = Config()
    var iterator = CommandLine.arguments.dropFirst().makeIterator()

    while let arg = iterator.next() {
        switch arg {
        case "--input":
            guard let value = iterator.next() else {
                throw OCRError.invalidArguments("--input 缺少值")
            }
            config.input = value
        case "--output-dir":
            guard let value = iterator.next() else {
                throw OCRError.invalidArguments("--output-dir 缺少值")
            }
            config.outputDir = value
        case "--start-page":
            guard let value = iterator.next(), let page = Int(value), page > 0 else {
                throw OCRError.invalidArguments("--start-page 必须是正整数")
            }
            config.startPage = page
        case "--end-page":
            guard let value = iterator.next(), let page = Int(value), page > 0 else {
                throw OCRError.invalidArguments("--end-page 必须是正整数")
            }
            config.endPage = page
        case "--dpi":
            guard let value = iterator.next(), let dpi = Double(value), dpi > 0 else {
                throw OCRError.invalidArguments("--dpi 必须是正数")
            }
            config.dpi = dpi
        case "--help", "-h":
            printUsage()
            exit(0)
        default:
            throw OCRError.invalidArguments("未知参数: \(arg)")
        }
    }

    if config.input.isEmpty {
        throw OCRError.invalidArguments("必须提供 --input")
    }

    return config
}

func ensureDirectory(_ path: String) throws {
    try FileManager.default.createDirectory(
        at: URL(fileURLWithPath: path),
        withIntermediateDirectories: true
    )
}

func renderPage(_ page: PDFPage, pageNumber: Int, dpi: Double) throws -> CGImage {
    let pageRect = page.bounds(for: .mediaBox)
    let scale = dpi / 72.0
    let width = max(Int(pageRect.width * scale), 1)
    let height = max(Int(pageRect.height * scale), 1)

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        throw OCRError.cannotRenderPage(pageNumber)
    }

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw OCRError.cannotRenderPage(pageNumber)
    }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    context.saveGState()
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: scale, y: -scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()

    guard let image = context.makeImage() else {
        throw OCRError.cannotEncodeImage(pageNumber)
    }
    return image
}

func recognizeText(from image: CGImage, pageNumber: Int) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
    request.minimumTextHeight = 0.0

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        throw OCRError.recognitionFailed(pageNumber, error.localizedDescription)
    }

    let observations = request.results ?? []
    let sorted = observations.sorted {
        let lhs = $0.boundingBox
        let rhs = $1.boundingBox
        if abs(lhs.minY - rhs.minY) > 0.015 {
            return lhs.minY > rhs.minY
        }
        return lhs.minX < rhs.minX
    }

    let lines = sorted.compactMap { observation in
        observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
    }.filter { !$0.isEmpty }

    return lines.joined(separator: "\n")
}

func main() throws {
    let config = try parseArgs()
    let inputURL = URL(fileURLWithPath: config.input)

    guard let document = PDFDocument(url: inputURL) else {
        throw OCRError.cannotOpenPDF(config.input)
    }

    let totalPages = document.pageCount
    let startIndex = max(config.startPage - 1, 0)
    let endIndex = min((config.endPage ?? totalPages) - 1, totalPages - 1)

    if startIndex > endIndex {
        throw OCRError.invalidArguments("页码范围无效")
    }

    let outputDir = URL(fileURLWithPath: config.outputDir)
    let pagesDir = outputDir.appendingPathComponent("pages", isDirectory: true)
    try ensureDirectory(outputDir.path)
    try ensureDirectory(pagesDir.path)

    var combined = ""
    var summary: [[String: Any]] = []

    for pageIndex in startIndex...endIndex {
        autoreleasepool {
            let pageNumber = pageIndex + 1
            print("[ocr] page \(pageNumber)/\(totalPages)")

            guard let page = document.page(at: pageIndex) else {
                fputs("跳过第 \(pageNumber) 页：无法读取页面对象\n", stderr)
                return
            }

            do {
                let image = try renderPage(page, pageNumber: pageNumber, dpi: config.dpi)
                let text = try recognizeText(from: image, pageNumber: pageNumber)
                let header = "===== Page \(pageNumber) =====\n"
                combined += header + text + "\n\n"

                let pagePath = pagesDir.appendingPathComponent(String(format: "%04d.txt", pageNumber))
                try (header + text + "\n").write(to: pagePath, atomically: true, encoding: .utf8)

                summary.append([
                    "page": pageNumber,
                    "characters": text.count
                ])
            } catch {
                fputs("第 \(pageNumber) 页失败：\(error)\n", stderr)
            }
        }
    }

    let combinedPath = outputDir.appendingPathComponent(config.combinedName)
    try combined.write(to: combinedPath, atomically: true, encoding: .utf8)

    let summaryPath = outputDir.appendingPathComponent("summary.json")
    let metadata: [String: Any] = [
        "input": inputURL.path,
        "output_dir": outputDir.path,
        "start_page": config.startPage,
        "end_page": endIndex + 1,
        "total_pages": totalPages,
        "dpi": config.dpi,
        "generated_at": ISO8601DateFormatter().string(from: Date()),
        "pages": summary
    ]
    let data = try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: summaryPath)

    print("[done] combined text: \(combinedPath.path)")
    print("[done] summary: \(summaryPath.path)")
}

do {
    try main()
} catch {
    fputs("\(error)\n", stderr)
    if case OCRError.invalidArguments = error {
        printUsage()
    }
    exit(1)
}
