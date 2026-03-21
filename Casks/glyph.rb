cask "glyph" do
  version "0.2.2"
  sha256 "a69cf10f9a851d1272c7ab3a6043507a95809d399d3ab8fb425e5dbd8bba6cd3"

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
