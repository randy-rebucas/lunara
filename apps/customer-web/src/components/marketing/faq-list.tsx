import Link from 'next/link';
import { FAQ_CATEGORIES } from './faq-data';

function FaqChevron() {
  return (
    <svg
      className="faq-chevron h-5 w-5 shrink-0 text-muted transition-transform duration-200"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FaqCategoryNav() {
  return (
    <nav aria-label="FAQ categories" className="faq-category-nav">
      {FAQ_CATEGORIES.map((category) => (
        <a key={category.id} href={`#${category.id}`} className="faq-category-pill">
          {category.label}
        </a>
      ))}
    </nav>
  );
}

export function FaqList() {
  return (
    <div className="faq-page">
      <FaqCategoryNav />

      <div className="faq-categories">
        {FAQ_CATEGORIES.map((category) => (
          <section key={category.id} id={category.id} className="faq-category scroll-mt-28">
            <div className="faq-category-header">
              <h2 className="text-lg font-semibold text-slate-900">{category.label}</h2>
              <p className="mt-1 text-sm text-muted">{category.description}</p>
            </div>

            <div className="faq-list">
              {category.items.map((item) => (
                <details key={item.id} id={item.id} className="faq-item group scroll-mt-28">
                  <summary className="faq-question">
                    <span>{item.question}</span>
                    <FaqChevron />
                  </summary>
                  <div className="faq-answer-wrap">
                    <p className="faq-answer">{item.answer}</p>
                    {item.links && item.links.length > 0 ? (
                      <div className="faq-answer-links">
                        {item.links.map((link) => (
                          <Link key={link.href} href={link.href} className="faq-answer-link">
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
