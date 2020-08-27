import { TestBed } from '@angular/core/testing';

import { SpotifyService } from './spotify.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('SpotifyService', () => {
  let service: SpotifyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SpotifyService]
    });
    service = TestBed.inject(SpotifyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
