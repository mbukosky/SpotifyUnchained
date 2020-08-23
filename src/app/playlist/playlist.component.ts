import { Component, OnInit, Input } from '@angular/core';
import { PlaylistItem } from '../api-format';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.css']
})
export class PlaylistComponent implements OnInit {

  @Input() playlist: PlaylistItem;

  constructor(private snackBar: MatSnackBar) { }

  ngOnInit(): void {
  }

  savePlaylist(): void {
    this.snackBar.open('Saving playlist is currently unsupported', 'OK', {
      duration: 2000,
    });
  }

}
