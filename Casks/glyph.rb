cask "glyph" do
  version "0.4.0"
  sha256 "8a2cd26ac61095ca69549a893e94e7b8449ed1a2ba7930601adef551391d4c84"

  url "https://github.com/FALAK097/glyph/releases/download/v#{version}/Glyph-mac.dmg"
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
