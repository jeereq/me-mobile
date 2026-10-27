import AVFoundation
import ExpoModulesCore

/// La voix personnelle d'iOS 17 et plus : l'utilisateur l'enregistre dans Réglages › Accessibilité › Voix personnelle,
/// puis autorise l'app à s'en servir. Une fois autorisée, elle apparaît parmi les voix d'expo-speech.
public class VoixPersonnelleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VoixPersonnelle")

    Function("etat") { () -> String in
      if #available(iOS 17.0, *) {
        return Self.texte(AVSpeechSynthesizer.personalVoiceAuthorizationStatus)
      }
      return "indisponible"
    }

    AsyncFunction("demander") { (promise: Promise) in
      if #available(iOS 17.0, *) {
        AVSpeechSynthesizer.requestPersonalVoiceAuthorization { statut in
          promise.resolve(Self.texte(statut))
        }
      } else {
        promise.resolve("indisponible")
      }
    }

    Function("voix") { () -> [[String: String]] in
      if #available(iOS 17.0, *) {
        return AVSpeechSynthesisVoice.speechVoices()
          .filter { $0.voiceTraits.contains(.isPersonalVoice) }
          .map { ["identifier": $0.identifier, "name": $0.name, "language": $0.language] }
      }
      return []
    }
  }

  @available(iOS 17.0, *)
  static func texte(_ statut: AVSpeechSynthesizer.PersonalVoiceAuthorizationStatus) -> String {
    switch statut {
    case .authorized: return "autorise"
    case .denied: return "refuse"
    case .notDetermined: return "a_demander"
    case .unsupported: return "indisponible"
    @unknown default: return "indisponible"
    }
  }
}
