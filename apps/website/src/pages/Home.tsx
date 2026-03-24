import HeroSection from './home/HeroSection';
import ProblemSection from './home/ProblemSection';
import HowItWorksSection from './home/HowItWorksSection';
import ExamplesSection from './home/ExamplesSection';
import IntegrationSection from './home/IntegrationSection';
import FooterCTASection from './home/FooterCTASection';

export default function Home() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <ExamplesSection />
      <IntegrationSection />
      <FooterCTASection />
    </>
  );
}
