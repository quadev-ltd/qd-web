// Decorative bars beside "Recording" (mock interviews) and "Listening" (dictation): the answer is
// being heard.
export const RecordingLevel: React.FC = () => (
  <span aria-hidden="true" className="flex h-8 items-center gap-1">
    {[8, 14, 22, 12, 26, 18, 10, 20, 28, 16, 9, 18].map((height, index) => (
      <span
        key={index}
        className="w-1 animate-pulse rounded-[2px] bg-primary motion-reduce:animate-none"
        style={{ height, animationDelay: `${index * 90}ms` }}
      />
    ))}
  </span>
);

export default RecordingLevel;
