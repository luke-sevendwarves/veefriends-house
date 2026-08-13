import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

// Usage: swift cutout.swift <input> <output>
// Uses Vision foreground-instance masking (same as Preview's "Remove Background")
// to lift the subject out of its background and write an RGBA PNG.

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: cutout <in.png> <out.png>\n".data(using: .utf8)!)
    exit(64)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let src = CIImage(contentsOf: inURL) else {
    FileHandle.standardError.write("cannot read \(args[1])\n".data(using: .utf8)!)
    exit(65)
}

let handler = VNImageRequestHandler(ciImage: src, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()

do {
    try handler.perform([request])
    guard let obs = request.results?.first, !obs.allInstances.isEmpty else {
        FileHandle.standardError.write("no foreground instances found\n".data(using: .utf8)!)
        exit(66)
    }
    let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances,
                                          from: handler,
                                          croppedToInstancesExtent: true)
    let out = CIImage(cvPixelBuffer: buf)
    let ctx = CIContext(options: [.workingColorSpace: NSNull()])
    try ctx.writePNGRepresentation(of: out,
                                   to: outURL,
                                   format: .RGBA8,
                                   colorSpace: CGColorSpaceCreateDeviceRGB(),
                                   options: [:])
    print("ok \(outURL.lastPathComponent) instances=\(obs.allInstances.count)")
} catch {
    FileHandle.standardError.write("vision failed: \(error)\n".data(using: .utf8)!)
    exit(67)
}
