import { motion } from "framer-motion";

interface Story {
  quote: string;
  author: string;
  result: string;
  initials?: string;
}

interface SuccessStoriesProps {
  title?: string;
  stories: Story[];
  containerClassName?: string;
}

export function SuccessStories({
  title,
  stories,
  containerClassName = "",
}: SuccessStoriesProps) {
  return (
    <motion.div
      className={`space-y-4 ${containerClassName}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {title && (
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          {title}
        </h3>
      )}

      <div className="space-y-3">
        {stories.map((story, idx) => (
          <motion.div
            key={`${story.author}-${idx}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className="glass-card glass-card-dark p-4"
          >
            <div className="flex gap-3 mb-3">
              {story.initials && (
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">
                    {story.initials}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-600 text-[var(--text-primary)]">
                  {story.author}
                </p>
                <p className="text-xs text-primary-600 font-500">
                  {story.result}
                </p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] italic">
              "{story.quote}"
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
