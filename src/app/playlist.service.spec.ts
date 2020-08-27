import { TestBed } from '@angular/core/testing';

import { PlaylistService } from './playlist.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('PlaylistService', () => {
  let service: PlaylistService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PlaylistService]
    });
    service = TestBed.inject(PlaylistService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get empty playlists successfully', () => {

    service.getPlaylists(0, 5, 'asc').subscribe(
      (resp) => {
        expect(resp.length).toEqual(0);
      },
      (error) => {
        fail(error);
      }
    );

    const mockResponse = {
      count: 0,
      items: []
    };

    const requestWrapper = httpTestingController.expectOne({ url: '/spotify?page=1&size=5&sort=asc' });
    requestWrapper.flush(mockResponse);

    expect(service.getTotalItems()).toEqual(0);
  });
});
