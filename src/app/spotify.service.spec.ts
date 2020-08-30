import { TestBed } from '@angular/core/testing';

import { SpotifyService } from './spotify.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('SpotifyService', () => {
  let service: SpotifyService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SpotifyService]
    });
    service = TestBed.inject(SpotifyService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('addPlaylistTracks()', () => {
    it('should POST to Spotify API with appropriate content', () => {

      service.addPlaylistTracks('thePlaylistId', ['uri1']).subscribe(
        (resp) => {
          expect(resp.snapshot_id = 'JbtmHBDBAYu3/bt8BOXKjzKx3i0b6LCa/wVjyl6qQ2Yf6nFXkbmzuEa+ZI/U1yF+');
        },
        fail
      );

      const mockResponse = {
        snapshot_id: 'JbtmHBDBAYu3/bt8BOXKjzKx3i0b6LCa/wVjyl6qQ2Yf6nFXkbmzuEa+ZI/U1yF+'
      };

      const requestWrapper = httpTestingController
        .expectOne('https://api.spotify.com/v1/playlists/thePlaylistId/tracks');
      expect(requestWrapper.request.method).toEqual('POST');
      const reqHeaders = requestWrapper.request.headers;
      expect(reqHeaders.get('Authorization')).toContain('Bearer');
      expect(reqHeaders.get('Content-Type')).toEqual('application/json');
      expect(requestWrapper.request.body).toEqual({
        uris: ['uri1']
      });

      requestWrapper.flush(mockResponse);
    });
  });

  describe('createPlaylist()', () => {

    beforeEach(() => {
      service.userSubject.next({
        birthdate: null,
        country: null,
        email: null,
        href: null,
        id: 'userid',
        product: null,
        type: null,
        external_urls: null,
        uri: null,
        display_name: null
      });
    });

    it('should POST to Spotify API with appropriate content', () => {

      service.createPlaylist('A New Playlist').subscribe(
        (resp) => {
          expect(resp.snapshot_id = 'JbtmHBDBAYu3/bt8BOXKjzKx3i0b6LCa/wVjyl6qQ2Yf6nFXkbmzuEa+ZI/U1yF+');
        },
        fail
      );

      const mockResponse = {
        name: 'A New Playlist',
        tracks: []
      };

      const requestWrapper = httpTestingController
        .expectOne('https://api.spotify.com/v1/users/userid/playlists');
      expect(requestWrapper.request.method).toEqual('POST');
      const reqHeaders = requestWrapper.request.headers;
      expect(reqHeaders.get('Authorization')).toContain('Bearer');
      expect(reqHeaders.get('Content-Type')).toEqual('application/json');
      expect(requestWrapper.request.body).toEqual({
        name: 'A New Playlist',
        public: false
      });

      requestWrapper.flush(mockResponse);

      const mockPlaylistsResponse = {
        items: [{
          name: 'A New Playlist'
        },
        {
          name: 'An Old Playlist'
        }]
      };

      // should also refresh playlists
      const getRequestWrapper = httpTestingController
        .expectOne('https://api.spotify.com/v1/me/playlists?limit=50');
      getRequestWrapper.flush(mockPlaylistsResponse);

      service.getUserSavedPlaylists().subscribe(
        (resp) => {
          expect(resp.items.map((item => item.name))).toContain('A New Playlist');
        },
        fail
      );
    });
  });
});
