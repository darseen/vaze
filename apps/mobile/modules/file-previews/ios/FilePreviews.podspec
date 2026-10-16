Pod::Spec.new do |s|
  s.name           = 'FilePreviews'
  s.version        = '1.0.0'
  s.summary        = 'Video frames and PDF pages for file previews'
  s.description    = 'Video frames and PDF pages for file previews'
  s.license        = 'MIT'
  s.author         = 'darseen'
  s.homepage       = 'https://github.com/darseen/vaze'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
