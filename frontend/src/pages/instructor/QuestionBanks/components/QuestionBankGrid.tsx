import { Link } from "react-router-dom";
import type { QuestionBank } from "@/api/types";
import { questionBanksStrings as strings } from "../QuestionBanks.strings";

interface QuestionBankGridProps {
  banks: QuestionBank[];
}

export function QuestionBankGrid({ banks }: QuestionBankGridProps) {
  const sections = strings.sectionLabels;
  return (
    <div className="bank-grid">
      {banks.map((bank) => (
        <Link className="bank-card" to={`/super-admin/instructor/question-banks/${bank.id}`} key={bank.id}>
          <div className="bank-card-top">
            <span className={`section-chip section-${bank.section}`}>{sections[bank.section as keyof typeof sections]}</span>
            <strong>{bank.question_count}</strong>
          </div>
          <h2>{bank.title}</h2>
          <p>{bank.description || strings.noDescription}</p>
          <div className="bank-card-footer">
            <span>{bank.course_title}</span>
            <span>{strings.byAuthor(bank.created_by_name)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
