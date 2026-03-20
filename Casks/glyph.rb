cask "glyph" do
  version "0.2.0"
  sha256 "2957c188066dc8a1dfb4053629ab7cb551eeb6b6d9b18f9ef134ef9c10326668"

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
