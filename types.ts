
export enum StoryGenre {
  ROMANCE = "রোমান্স (Romance)",
  THRILLER = "থ্রিলার (Thriller)",
  HORROR = "ভৌতিক (Horror)",
  DRAMA = "নাটকীয় (Drama)",
  ADULT = "প্রাপ্তবয়স্ক / ১৮+ (Adult 18+)",
  MYSTERY = "রহস্য (Mystery)",
  SCIFI = "কল্পবিজ্ঞান (Sci-Fi)"
}

export enum StoryLength {
  SHORT = "ছোট গল্প (Short Story)",
  MEDIUM = "মাঝারি (Medium)",
  LONG = "উপন্যাস (Novel/Long Story)"
}

export enum ChangeLevel {
  SLIGHT = "SLIGHT",
  MAJOR = "MAJOR"
}

export enum RegenTarget {
  SELECTION = "SELECTION",
  PARAGRAPH = "PARAGRAPH",
  ALL = "ALL"
}

export interface StoryState {
  title: string;
  content: string;
  genre: StoryGenre;
  length: StoryLength;
}

export interface GenerationConfig {
  prompt: string;
  genre: StoryGenre;
  length: StoryLength;
  tone: string;
}
