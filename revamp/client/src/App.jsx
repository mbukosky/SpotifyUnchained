import { ThemeProvider } from './hooks/useTheme';
import { RegionProvider } from './hooks/useRegion';
import Header from './components/Header';
import PlaylistList from './components/PlaylistList';
import Footer from './components/Footer';

export default function App() {
  return (
    <ThemeProvider>
      <RegionProvider>
        <div className="grain-overlay" aria-hidden="true" />
        <Header />
        <main className="main-content">
          <div className="container">
            <PlaylistList />
          </div>
        </main>
        <Footer />
      </RegionProvider>
    </ThemeProvider>
  );
}
