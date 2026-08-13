import Foundation
import Speech

// Usage: swift transcribe.swift <audio file>
// On-device speech recognition with word-level timestamps, so we can find
// exactly where a phrase lands in the clip.

let args = CommandLine.arguments
guard args.count >= 2 else { exit(64) }
let url = URL(fileURLWithPath: args[1])

let sem = DispatchSemaphore(value: 0)
var authorized = false
SFSpeechRecognizer.requestAuthorization { status in
    authorized = (status == .authorized)
    sem.signal()
}
sem.wait()
guard authorized else {
    FileHandle.standardError.write("speech recognition not authorized\n".data(using: .utf8)!)
    exit(77)
}

guard let rec = SFSpeechRecognizer(locale: Locale(identifier: "en-US")), rec.isAvailable else {
    FileHandle.standardError.write("recognizer unavailable\n".data(using: .utf8)!)
    exit(78)
}

let req = SFSpeechURLRecognitionRequest(url: url)
req.shouldReportPartialResults = false
if #available(macOS 13.0, *) { req.addsPunctuation = true }
req.requiresOnDeviceRecognition = false   // server-side; user approved the upload

let done = DispatchSemaphore(value: 0)
rec.recognitionTask(with: req) { result, error in
    if let error = error {
        FileHandle.standardError.write("error: \(error)\n".data(using: .utf8)!)
        done.signal(); return
    }
    guard let result = result, result.isFinal else { return }
    print("TRANSCRIPT: \(result.bestTranscription.formattedString)\n")
    for seg in result.bestTranscription.segments {
        let t = String(format: "%6.2f", seg.timestamp)
        let d = String(format: "%5.2f", seg.duration)
        print("\(t)  +\(d)  \(seg.substring)")
    }
    done.signal()
}
_ = done.wait(timeout: .now() + 600)
