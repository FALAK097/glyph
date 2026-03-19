import { 
  Github, 
  Monitor, 
  FileText, 
  Eye, 
  Pencil, 
  FolderOpen, 
  Search, 
  Palette, 
  Zap, 
  Code2,
  FileCode,
  Clock,
  Shield
} from "lucide-react";

const GithubIcon = Github;
const AppleIcon = () => (
  <svg
    viewBox="0 0 384 512"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    height="18"
    width="18"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 56-12 69.5-34.3z"/>
  </svg>
);

const WindowsIcon = () => (
  <svg
    viewBox="0 0 88 88"
    xmlns="http://www.w3.org/2000/svg"
    height="18"
    width="18"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m0 12.402 35.687-4.86.016 34.423-35.67.203zm35.67 33.529.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349-.011 41.34-47.318-6.678-.066-34.739z" fill="currentColor"/>
  </svg>
);

export function App() {
  const features = [
    {
      icon: Eye,
      title: "Beautiful Markdown Rendering",
      description: "Best-in-class rendering with readable typography, code blocks, tables, task lists, and more.",
    },
    {
      icon: Pencil,
      title: "Desktop-First Editor",
      description: "Open folders, browse notes from the sidebar, and keep edits live as you work.",
    },
    {
      icon: Search,
      title: "Instant Search",
      description: "Find anything in your workspace with lightning-fast search across all files.",
    },
    {
      icon: Palette,
      title: "Light & Dark Themes",
      description: "Switch between beautiful light and dark themes to match your preference.",
    },
    {
      icon: Code2,
      title: "Command Palette",
      description: "Access all features with keyboard shortcuts. Never leave the keyboard.",
    },
    {
      icon: FolderOpen,
      title: "Workspace Management",
      description: "Open any folder as your workspace. Browse files recursively and organize your notes.",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Built with performance in mind. Opens instantly, searches instantly, saves instantly.",
    },
    {
      icon: Shield,
      title: "Local-First Design",
      description: "Your files stay on your device. No cloud sync, no account required.",
    },
  ];

  return (
    <main className="landing-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="landing-bg" />
      
      <header className="landing-header">
        <div className="landing-logo">
          <img src="/icon.png" alt="Glyph Logo" width="32" height="32" className="logo-bg rounded-lg" />
          <span>Glyph</span>
        </div>
        
        <nav className="landing-nav">
          <a 
            href="https://github.com/FALAK097/glyph" 
            className="landing-github"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
          >
            <GithubIcon size={24} aria-hidden="true" />
          </a>
        </nav>
      </header>

      <section className="landing-hero" id="main-content">
        <div className="landing-badge">
          <span className="landing-badge-dot" />
          <span>Markdown, without the bloat</span>
        </div>
        
        <h1>Your notes,<br />beautifully simple.</h1>
        
        <p className="landing-hero-subtitle">
          A minimal markdown viewer and editor for macOS and Windows. 
          Browse local notes, edit markdown fast, and read rendered documents 
          in a focused desktop workspace.
        </p>
        
        <div className="landing-actions">
          <a className="landing-button landing-button-primary" href="/downloads/glyph-macos.dmg">
            <AppleIcon />
            Download for macOS
          </a>
          <a className="landing-button landing-button-secondary" href="/downloads/glyph-windows.exe">
            <WindowsIcon />
            Download for Windows
          </a>
        </div>
        
        <p className="landing-platform-note">Available for macOS and Windows</p>
      </section>

      <section className="landing-features">
        <div className="landing-features-header">
          <h2>Everything you need</h2>
          <p>A powerful yet minimal markdown editor that puts your content first.</p>
        </div>
        
        <div className="bento-grid">
          {features.slice(0, 2).map((feature, index) => (
            <article key={index} className={`bento-card ${index === 0 ? 'bento-card-large' : ''}`}>
              <div className="bento-card-icon">
                <feature.icon size={24} aria-hidden="true" />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
          
          {features.slice(2, 5).map((feature, index) => (
            <article key={index + 2} className="bento-card">
              <div className="bento-card-icon">
                <feature.icon size={24} aria-hidden="true" />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
          
          {features.slice(5, 7).map((feature, index) => (
            <article key={index + 5} className={`bento-card ${index === 0 ? 'bento-card-large' : ''}`}>
              <div className="bento-card-icon">
                <feature.icon size={24} aria-hidden="true" />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Built by <a href="https://falakgala.dev" target="_blank" rel="noopener noreferrer">Falak Gala</a></p>
      </footer>
    </main>
  );
}

export default App;
