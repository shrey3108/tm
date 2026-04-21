import re
import tempfile
import os
from typing import TypedDict
from markitdown import MarkItDown


class DialogueTurn(TypedDict):
    speaker: str
    timestamp: str | None
    text: str


# Slightly shorter filler words set (avoiding meaningful words like "sure", "okay", "right")
FILLER_WORDS = {
    "uh", "um", "umm", "uhh", "hmm", "hm", "mhm",
    "aha", "ahh", "ohh", "ooh",
    "literally", "basically", "actually",
    "you know", "i mean", "kind of", "sort of",
    "like", "yeah", "yep", "yup", "nope"
}


def remove_markdown_garbage(text: str) -> str:
    """Removes standard markdown formatting from MarkItDown output."""
    # Base64 images
    text = re.sub(r'!\[.*?\]\(data:image/[^)]*\)', '', text)
    # Other images
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    # Bold **bold** -> plain
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    # Italic *italic* -> plain
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    # Remove escaped markdown characters
    text = text.replace(r'\_', '_').replace(r'\-', '-').replace(r'\*', '*')
    # Remove markdown headers
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    return text


def clean_transcript_text(text: str) -> str:
    """Cleans up formatting, multiple spaces, and normalizes punctuation."""
    # Remove leading dots/commas from lines
    text = re.sub(r'^[,.\s]+', '', text, flags=re.MULTILINE)
    # Remove lines containing only punctuation
    text = re.sub(r'^\s*[.,\s]+\s*$', '', text, flags=re.MULTILINE)
    # Reduce multiple spaces to single space
    text = re.sub(r'[ \t]+', ' ', text)
    # Reduce repeated punctuation
    text = re.sub(r'\.{2,}', '.', text)
    text = re.sub(r'\?{2,}', '?', text)
    text = re.sub(r'!{2,}', '!', text)
    # Reduce multiple newlines to max two (paragraph break)
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Trim lines
    text = '\n'.join(line.strip() for line in text.split('\n'))
    return text.strip()


def remove_filler_words(text: str) -> str:
    """Removes non-essential filler words from the transcript."""
    multi_word_phrases = ["you know", "i mean", "kind of", "sort of"]
    for phrase in multi_word_phrases:
        text = re.sub(rf'\b{re.escape(phrase)}\b', '', text, flags=re.IGNORECASE)
    
    for word in FILLER_WORDS - set(multi_word_phrases):
        text = re.sub(rf'\b{re.escape(word)}\b', '', text, flags=re.IGNORECASE)
        
    # Extra whitespace cleanup might be needed after removing words
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def extract_dialogues(text: str) -> list[DialogueTurn]:
    """
    Parses continuous text into speaker dialogues using time-based signatures.
    Handles variable speaker names and hour-based timestamps.
    Supports formats like:
      "John Doe 14:02" or "Interviewer 1:04:12"
    """
    dialogues: list[DialogueTurn] = []
    lines = text.split('\n')

    # Enhanced pattern: Catches variable length names and mm:ss or hh:mm:ss
    pattern = re.compile(
        r'^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$'
    )

    current_speaker = None
    current_ts = None
    current_lines = []

    def save_current_dialogue():
        if current_speaker and current_lines:
            dialogue_text = ' '.join(current_lines).strip()
            if len(dialogue_text) >= 2:  # Avoid saving single blank characters
                dialogues.append({
                    "speaker": current_speaker.strip(),
                    "timestamp": current_ts,
                    "text": dialogue_text
                })

    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        match = pattern.match(line)
        if match:
            # New speaker detected, save previous speaker's backlog
            save_current_dialogue()
            current_speaker = match.group(1)
            current_ts = match.group(2)
            current_lines = []
        else:
            # It's a continuation of the dialogue
            if current_speaker and not re.match(r'^[.,\s]+$', line):
                current_lines.append(line)

    # Save the last entry in the file
    save_current_dialogue()

    return dialogues


def chunk_dialogues(dialogues: list[DialogueTurn], chunk_size_turns: int = 10, overlap_turns: int = 2) -> list[str]:
    """
    Groups individual dialogues into larger chunks (windows) with an overlap based on 'turns'.
    This retains full context rather than breaking strings arbitarily by word count.
    """
    if not dialogues:
        return []

    chunks = []
    total_turns = len(dialogues)
    step = chunk_size_turns - overlap_turns
    
    if step <= 0:
        step = 1 # Fallback to prevent infinite loops

    for i in range(0, total_turns, step):
        window = dialogues[i : i + chunk_size_turns]
        # Format the chunk clearly
        chunk_text = "\n".join(
            f"{d['speaker']} [{d['timestamp']}]: {d['text']}" for d in window
        )
        chunks.append(chunk_text)
        
        if i + chunk_size_turns >= total_turns:
            break
            
    return chunks


def process_transcript_file(file_content: bytes, file_extension: str) -> dict:
    """
    Main utility function to ingest .docx or .pdf content, clean it,
    parse dialogues, and chunk it for further embedding/evaluation logic.
    Returns a structured dictionary of the processed data.
    """
    valid_exts = {".docx", ".pdf"}
    if file_extension.lower() not in valid_exts:
        raise ValueError(f"Invalid file type. Allowed: {valid_exts}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        # 1. Extract markdown content via MarkItDown
        md = MarkItDown()
        result = md.convert(tmp_path)
        raw_text = result.text_content
        
        # 2. Sequential Cleaning Pipeline
        text = remove_markdown_garbage(raw_text)
        text = clean_transcript_text(text)
        text = remove_filler_words(text)
        text = clean_transcript_text(text) # Final cleanup of created double spaces
        
        # 3. Parse Structurally
        dialogues = extract_dialogues(text)
        
        # Fallback if Regex parsing fails entirely (e.g. no timestamps exist in transcript)
        # We treat the entire cleaned text as one block/dialogue chunk
        if not dialogues:
            dialogues = [{"speaker": "Unknown", "timestamp": "0:00", "text": text}]
            
        chunks = chunk_dialogues(dialogues, chunk_size_turns=10, overlap_turns=2)
        
        return {
            "raw_clean_text": text,
            "dialogue_count": len(dialogues),
            "dialogues": dialogues,
            "chunks": chunks
        }
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
