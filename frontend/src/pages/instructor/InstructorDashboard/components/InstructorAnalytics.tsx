import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Icon } from "@/components/icons";
import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";
import type { InstructorCourseUsage, InstructorTrendPoint } from "../types";

function AnalyticsEmpty({ title, message }: { title: string; message: string }) {
  return (
    <section className="chart-card reference-styled-chart instructor-analytics-empty" aria-label={title}>
      <span className="instructor-analytics-empty-icon" aria-hidden="true"><Icon name="analytics" /></span>
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

interface InstructorAnalyticsProps {
  courseUsage: InstructorCourseUsage[];
  gradingTrend: InstructorTrendPoint[];
  showLearnerUsage?: boolean;
}

function compactCourseLabel(course: InstructorCourseUsage): string {
  const titleParts = course.title.split(/\s[-\u2013\u2014]\s/);
  const specificTitle = titleParts.at(-1)?.trim();
  if (specificTitle && specificTitle.length <= 18) return specificTitle;

  return course.title;
}

export function InstructorAnalytics({ courseUsage, gradingTrend, showLearnerUsage = true }: InstructorAnalyticsProps) {
  const learnerData = courseUsage
    .filter((course) => course.learners > 0)
    .slice(0, 8)
    .map((course) => ({
      label: compactCourseLabel(course),
      value: course.learners,
      subtext: strings.analytics.learnerSubtext(course.attempts),
    }));
  const hasGradingTrend = gradingTrend.some((point) => point.value > 0);

  return (
    <div className="instructor-analytics-grid">
      {showLearnerUsage && (
        learnerData.length > 0 ? (
          <BarChart
            data={learnerData}
            title={strings.analytics.learnersTitle}
            ariaLabel={strings.analytics.learnersAriaLabel}
          />
        ) : (
          <AnalyticsEmpty title={strings.analytics.learnersTitle} message={strings.analytics.learnersEmpty} />
        )
      )}

      {hasGradingTrend ? (
        <LineChart
          data={gradingTrend}
          title={strings.analytics.gradingTitle}
          ariaLabel={strings.analytics.gradingAriaLabel}
          color="var(--series-2)"
        />
      ) : (
        <AnalyticsEmpty title={strings.analytics.gradingTitle} message={strings.analytics.gradingEmpty} />
      )}
    </div>
  );
}
