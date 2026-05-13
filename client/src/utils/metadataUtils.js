/**
 * Extracts title and artist from an audio file using filename fallback
 * (Avoiding music-metadata-browser to keep the app clean of polyfills)
 */
export async function extractAudioMetadata(file) {
  // Filename parsing
  // Expected formats: "Artist - Song.mp3" or "Song.mp3" or "Artist - Song (Official Video).mp3"
  let fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
  
  // Remove common fluff like (Official Video), [Audio], etc.
  fileName = fileName.replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').trim();

  if (fileName.includes(' - ')) {
    const parts = fileName.split(' - ').map(s => s.trim());
    const song = parts[0];
    const artist = parts.slice(1).join(' - '); 
    return { song, artist, source: 'filename' };
  }

  return { song: fileName, artist: '', source: 'filename' };
}
