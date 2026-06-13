import React from 'react';

function App() {
  // We use inline styles for absolute positioning of the 1080x1350 canvas
  // to ensure it perfectly exports to Stitch.
  
  return (
    <div className="flex justify-center items-center min-h-screen bg-neutral-900 p-8">
      
      {/* The Template Canvas */}
      <div 
        className="relative bg-brand-dark overflow-hidden flex flex-col"
        style={{ width: '1080px', height: '1350px' }}
        dir="rtl"
      >
        
        {/* Background gradient from the original design */}
        <div className="absolute inset-0 news-gradient opacity-90 z-0"></div>

        {/* 1. News Image Area (Top Half) */}
        <div className="relative w-full h-[65%] z-10">
          <img 
            src="https://images.unsplash.com/photo-1590080874088-eec64895e423?auto=format&fit=crop&q=80&w=1080&h=1350" 
            alt="News Subject" 
            className="w-full h-full object-cover rounded-b-[48px]"
          />
          {/* Gradient fade to blend image with background */}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/40 to-transparent"></div>
        </div>

        {/* 2. Text Content Area (Bottom Half) */}
        <div className="relative flex flex-col justify-end px-16 pb-16 z-20 flex-grow -mt-32">
          
          {/* Headline - Uses standard flex box to avoid overlap */}
          <div className="mb-12">
            <h1 className="text-white font-bold leading-tight" style={{ fontSize: '64px' }}>
              وزير الخارجية أسعد الشيباني يتسلم أوراق اعتماد السفير البابوي الجديد لدى دمشق في مراسم رسمية
            </h1>
          </div>

          {/* Green Ribbon - Title and Name */}
          <div className="flex items-center gap-6 bg-brand-green rounded-xl py-6 px-10 self-start shadow-2xl">
            <h2 className="text-white font-bold" style={{ fontSize: '48px' }}>
              المطران لويجي كونا
            </h2>
            <div className="w-1 h-12 bg-white/40 rounded-full"></div>
            <h3 className="text-white/90 font-semibold" style={{ fontSize: '36px' }}>
              السفير البابوي لدى سوريا
            </h3>
          </div>

        </div>

        {/* 3. Handle / Footer */}
        <div className="absolute bottom-12 left-16 z-30">
          <p className="text-white/80 font-bold" style={{ fontSize: '32px' }} dir="ltr">
            @HashSYR24
          </p>
        </div>

      </div>

    </div>
  );
}

export default App;
