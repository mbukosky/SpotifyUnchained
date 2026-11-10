import { RegionProvider } from './hooks/useRegion';
import { SpotifyAuthProvider } from './hooks/useSpotifyAuth';
import MeshBackground from './components/MeshBackground';
import Header from './components/Header';
import SessionExpiredBanner from './components/SessionExpiredBanner';
import Archive from './components/Archive';
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
          <main className="archive">
            <Archive />
          </main>
          <Footer />
        </div>
      </SpotifyAuthProvider>
    </RegionProvider>
  );
}
