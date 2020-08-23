export interface ApiResponse {
    count: number;
    items: PlaylistItem[];
}

export interface PlaylistItem {
    title: string;
    published_date: string;
    tracks: TrackItem[];
}

export interface TrackItem {
    created: string;
    _id: string;
    id: string;
    name: string;
    artist: string;
    added_at: string;
    open_url: string;
    uri: string;
}
