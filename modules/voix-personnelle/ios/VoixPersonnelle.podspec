Pod::Spec.new do |s|
  s.name           = 'VoixPersonnelle'
  s.version        = '1.0.0'
  s.summary        = 'Voix personnelle iOS (Personal Voice) pour Me'
  s.description    = 'Demande à iOS le droit de lire avec la voix personnelle enregistrée par l’utilisateur.'
  s.author         = ''
  s.homepage       = 'https://github.com/jeereq/me-mobile'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
