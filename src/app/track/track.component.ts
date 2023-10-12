import { Component, OnInit, Input } from '@angular/core';
import { TrackItem } from '../api-format';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-track',
  templateUrl: './track.component.html',
  styleUrls: ['./track.component.scss']
})
export class TrackComponent {

  @Input() track: TrackItem;
  playClicked = false;

  constructor(private sanitizer: DomSanitizer) {
    this.sanitizer = sanitizer;
  }

  safeTrackUrl(): SafeUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl('https://open.spotify.com/embed/track/' + this.track.id);
  }

  clickPlayButton(): void {
    this.playClicked = true;
  }

}
