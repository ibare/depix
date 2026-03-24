export interface Dictionary {
  nav: {
    home: string;
    useCases: string;
    playground: string;
    docs: string;
    try: string;
  };
  hero: {
    headline: string;
    sub: string;
    cta_playground: string;
    cta_github: string;
  };
  problem: {
    title: string;
    before_title: string;
    before_desc: string;
    after_title: string;
    after_desc: string;
  };
  howItWorks: {
    title: string;
    sub: string;
    step1: string;
    step2: string;
    step3: string;
  };
  examples: {
    title: string;
    sub: string;
    prompt_label: string;
    dsl_label: string;
    result_label: string;
    tabs: {
      flowchart: string;
      slides: string;
      dashboard: string;
      architecture: string;
    };
    prompts: {
      flowchart: string;
      slides: string;
      dashboard: string;
      architecture: string;
    };
  };
  integration: {
    title: string;
    sub: string;
    react_title: string;
    react_desc: string;
    markdown_title: string;
    markdown_desc: string;
    api_title: string;
    api_desc: string;
  };
  footerCta: {
    title: string;
  };
  useCases: {
    title: string;
    sub: string;
    markdown_title: string;
    markdown_desc: string;
    slides_title: string;
    slides_desc: string;
    image_title: string;
    image_desc: string;
    app_title: string;
    app_desc: string;
  };
  playground: {
    title: string;
    placeholder: string;
    error_label: string;
  };
  placeholder: {
    coming_soon: string;
    back_home: string;
  };
  footer: {
    tagline: string;
  };
}

export type Lang = 'en' | 'ko';
