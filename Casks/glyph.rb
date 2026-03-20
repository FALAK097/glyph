cask "glyph" do
  version "0.2.1"
  sha256 "31ef1e51ee03d3ce699be60ca65f2de5fca2099190abcb908e60315e8b0d298d"

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
