import { Component, OnInit, Input } from '@angular/core';
import { TrackItem } from '../api-format';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-track',
  templateUrl: './track.component.html',
  styleUrls: ['./track.component.css']
})
export class TrackComponent implements OnInit {

  @Input() track: TrackItem;

  constructor(private sanitizer: DomSanitizer) {
    this.sanitizer = sanitizer;
  }

  ngOnInit(): void {
  }

  safeTrackUrl(): SafeUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl('https://open.spotify.com/embed/track/' + this.track.id);
  }

}
