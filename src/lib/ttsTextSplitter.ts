/**
 * Split a long text into TTS-friendly chunks of at most `maxChars` characters.
 *
 * The Inworld TTS edge function caps a single request at 5000 chars; we use a
 * smaller default (1500) so that prosody stays consistent and audio chunks
 * concatenate naturally without long silences.
 *
 * The splitter prefers boundaries in this order:
 *   1. Paragraph break (\n\n)
 *   2. Sentence end (. ! ?)
 *   3. Comma / semicolon
 *   4. Whitespace
 *   5. Hard cut at maxChars
 */
export function splitTextForTTS(text: string, maxChars = 1500): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxChars) {
    const slice = remaining.slice(0, maxChars + 1);

    // Look for the latest sensible break inside the slice
    let cut = -1;
    const paragraph = slice.lastIndexOf("\n\n");
    if (paragraph > maxChars * 0.4) cut = paragraph + 2;

    if (cut < 0) {
      const sentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
      );
      if (sentence > maxChars * 0.4) cut = sentence + 1;
    }

    if (cut < 0) {
      const comma = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "));
      if (comma > maxChars * 0.5) cut = comma + 1;
    }

    if (cut < 0) {
      const space = slice.lastIndexOf(" ");
      cut = space > 0 ? space : maxChars;
    }

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Concatenate multiple MP3 / WAV ArrayBuffers into a single Blob. We don't do
 * any container fixup — for MP3 streams a naive concat works fine in browsers,
 * for WAV we re-emit a minimal header by trusting the first chunk's header
 * and appending the data sections.
 */
export function concatAudioBuffers(buffers: ArrayBuffer[], mime: string): Blob {
  if (buffers.length === 0) return new Blob([], { type: mime });
  if (buffers.length === 1) return new Blob([buffers[0]], { type: mime });

  if (mime === "audio/wav") {
    return concatWav(buffers);
  }
  // MP3: simple concat works in HTML5 audio
  return new Blob(buffers, { type: mime });
}

function concatWav(buffers: ArrayBuffer[]): Blob {
  // WAV header is 44 bytes. We strip it from chunks 2..N and update sizes
  // in the first chunk's header.
  const HEADER = 44;
  const dataParts: Uint8Array[] = [new Uint8Array(buffers[0])];
  let totalDataBytes = buffers[0].byteLength - HEADER;

  for (let i = 1; i < buffers.length; i++) {
    const view = new Uint8Array(buffers[i]);
    if (view.length <= HEADER) continue;
    const data = view.slice(HEADER);
    dataParts.push(data);
    totalDataBytes += data.length;
  }

  // Patch sizes in the header (RIFF chunk size at offset 4, data chunk size at 40)
  const header = dataParts[0];
  const headerView = new DataView(header.buffer, header.byteOffset, HEADER);
  headerView.setUint32(4, totalDataBytes + 36, true);
  headerView.setUint32(40, totalDataBytes, true);

  return new Blob(dataParts, { type: "audio/wav" });
}
