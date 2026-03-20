cask "glyph" do
  version "0.1.0"
  sha256 "e853ba1b75d3e362e7d2f5dbd4a6cffc3a7c49ee46f98361388bcd9956434856"

  url "https://github.com/FALAK097/glyph/releases/download/v#{version}/Glyph-#{version}-mac.dmg"
  name "Glyph"
  desc "Minimal markdown viewer and editor"
  homepage "https://github.com/FALAK097/glyph"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Glyph.app"

  zap trash: [
    "~/Library/Application Support/Glyph",
    "~/Library/Preferences/com.falakgala.glyph.plist",
    "~/Library/Saved Application State/com.falakgala.glyph.savedState",
  ]
end
