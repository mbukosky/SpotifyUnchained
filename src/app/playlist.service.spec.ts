import { TestBed } from '@angular/core/testing';

import { PlaylistService } from './playlist.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';

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
      fail
    );

    const mockResponse = {
      count: 0,
      items: []
    };

    const requestWrapper = httpTestingController.expectOne({ url: '/spotify?page=1&size=5&sort=asc' });
    expect(requestWrapper.request.method).toEqual('GET');
    requestWrapper.flush(mockResponse);

    expect(service.getTotalItems()).toEqual(0);
  });

  it('should throw an error when there is a request error', () => {

    service.getPlaylists(0, 5, 'asc').subscribe(
      fail,
      (error: HttpErrorResponse) => {
        expect(error.status).toEqual(404);
      }
    );

    const requestWrapper = httpTestingController.expectOne({ url: '/spotify?page=1&size=5&sort=asc' });
    expect(requestWrapper.request.method).toEqual('GET');
    requestWrapper.flush('404', { status: 404, statusText: 'Not Found' });
  });
});
