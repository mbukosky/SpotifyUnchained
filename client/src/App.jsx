import { RegionProvider } from './hooks/useRegion';
import { SpotifyAuthProvider } from './hooks/useSpotifyAuth';
import MeshBackground from './components/MeshBackground';
import Header from './components/Header';
import SessionExpiredBanner from './components/SessionExpiredBanner';
import Hero from './components/Hero';
import PlaylistList from './components/PlaylistList';
import Footer from './components/Footer';

export default function App() {
  return (
    <RegionProvider>
      <SpotifyAuthProvider>
        <MeshBackground />
        <div className="grain" aria-hidden="true" />
        <div className="page">
          <Header />
          <SessionExpiredBanner />
          <Hero />
          <main className="archive">
            <PlaylistList />
          </main>
          <Footer />
        </div>
      </SpotifyAuthProvider>
    </RegionProvider>
  );
}
