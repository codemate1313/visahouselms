interface SecurityWatermarkProps {
  firstName: string | undefined;
  lastName: string | undefined;
  userId: number | undefined;
  attemptId: number;
  watermarkTime: Date;
}

export function SecurityWatermark({ firstName, lastName, userId, attemptId, watermarkTime }: SecurityWatermarkProps) {
  return (
    <div className="test-security-watermark" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index}>
          {firstName} {lastName} · Student {userId} · Attempt {attemptId} · {watermarkTime.toLocaleTimeString()}
        </span>
      ))}
    </div>
  );
}
