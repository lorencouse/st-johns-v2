/**
 * The one real St. John's service the landing page demonstrates with.
 *
 * All of it is public: titles, dates and lengths from the church's YouTube
 * channel, and one passage of the service's own auto-caption. Swapping in
 * another service is a change to this file alone.
 */

const thumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

const watchUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

export const channel = {
  name: "St. John's Presbyterian Church, San Francisco",
  handle: "youtube.com/@stjohnssf",
};

export const service = {
  title: "The Gospel of Mark: Week 18",
  date: "October 25, 2026",
  shortDate: "October 25",
  length: "52:50",
  lengthInWords: "53 min",
  url: watchUrl("i079i5rivQU"),
  thumbnail: thumbnail("i079i5rivQU"),
};

/** `service.url` at `time` ("m:ss" or "h:mm:ss"), for a heading's link back into the video. */
export const momentUrl = (time: string) =>
  `${service.url}&t=${time.split(":").reduce((seconds, part) => seconds * 60 + Number(part), 0)}s`;

/** The newest services in the channel's library, newest first. */
export const library = [
  service,
  {
    title: "The Gospel of Mark: Week 17",
    date: "October 18, 2026",
    length: "1:00:25",
    url: watchUrl("ZvgHlW_lmlc"),
    thumbnail: thumbnail("ZvgHlW_lmlc"),
  },
  {
    title: "The Gospel of Mark: Week 16",
    date: "October 11, 2026",
    length: "1:05:55",
    url: watchUrl("FYaUyUGhHPA"),
    thumbnail: thumbnail("FYaUyUGhHPA"),
  },
];

/** A run of caption text; `dropped` marks words the edit removes. */
export interface CaptionRun {
  text: string;
  dropped?: boolean;
}

/**
 * The post made from `service`. The caption is the service's YouTube
 * auto-caption, word for word, and `time` is each part's start in the video,
 * both from the service's own timed caption track. The edit and the headings
 * follow the cleanup and structure prompts in `src/server/ai/`.
 */
export const post = {
  title: "You Have Done What You Could",
  sections: [
    { time: "0:15", heading: "Welcome" },
    { time: "4:09", heading: "Call to Worship" },
    { time: "11:22", heading: "Prayer of Forgiveness" },
    { time: "12:41", heading: "Children's Story: The Gift of Nothing" },
    { time: "19:34", heading: "Scripture Reading: Mark 14:1–9" },
    { time: "22:20", heading: "Dinner in Bethany" },
    { time: "25:00", heading: "When Generosity Becomes a Hammer" },
    { time: "28:12", heading: "Picnics in Pasadena Central Park" },
    { time: "35:49", heading: "Time to Pray and Respond" },
    { time: "42:12", heading: "Prayers of the People" },
    { time: "45:13", heading: "Announcements" },
    { time: "51:17", heading: "Benediction" },
  ],
  /** The section the passage below comes from. */
  passageSection: 5,
  /** Where the passage itself starts in the video. */
  passageTime: "22:29",
  caption: [
    { text: "Um", dropped: true },
    {
      text: " it was dinner time in Bethany. This was just a few miles away from Jerusalem as I mentioned, that's where Jesus' ministry had taken him, but he stepped away ",
    },
    { text: "um", dropped: true },
    { text: " to Bethany for a bit for this meal with Simon. Simon was a man who needed to be healed." },
  ] satisfies CaptionRun[],
  edited:
    "It was dinner time in Bethany. This was just a few miles away from Jerusalem. As I mentioned, that's where Jesus' ministry had taken him, but he stepped away to Bethany for a bit for this meal with Simon. Simon was a man who needed to be healed.",
};
