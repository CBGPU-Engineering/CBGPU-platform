'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import GPUCard from '@/components/GPUCard';
import WeeklyGPUCard from '@/components/WeeklyGPUCard';
import { useAuth } from '@/lib/useAuth';

export default function Home() {
  const { user, isLoading } = useAuth();
  const [gpus, setGpus] = useState<any[]>([]);

  useEffect(() => {
    const fetchGPUs = async () => {
      const { data } = await supabase.from('gpus').select('*').order('id');
      if (data && data.length > 0) {
        const formattedData = data.map((gpu, index) => ({
          ...gpu,
          displayId: index + 1
        }));
        setGpus(formattedData);
      } else {
        setGpus([
          { id: 1, displayId: 1, name: "RTX5000" },
          { id: 2, displayId: 2, name: "RTX5000" },
          { id: 3, displayId: 3, name: "RTX5000" },
          { id: 4, displayId: 4, name: "RTX5000" },
        ]);
      }
    };
    fetchGPUs();
  }, []);

  return (
    <div className="container mx-auto py-8 md:py-16 px-4 md:px-6">
      <div className="mb-12 md:mb-20 flex flex-col items-center text-center gap-4">
        <img 
          src="https://i.namu.wiki/i/qMgg10XRSaTorhAnQaV-bKbUWK_xIlq2socc7pVyw1SJmovke8gEWfeofFitiIJ1VBMngGy4o1NuAnjrOA0m1w.webp" 
          alt="School Logo" 
          className="w-24 md:w-32 h-24 md:h-32 mb-4 object-contain animate-in zoom-in duration-700"
        />
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter italic uppercase">
            충북과학고등학교 <br className="sm:hidden" />
            <span className="text-primary block sm:inline sm:ml-2">GPU Rental System</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-xl max-w-2xl mx-auto font-bold uppercase tracking-wide opacity-80">
            AI 학습을 위한 충곽 유일의 서비스
          </p>
        </div>
        <div className="h-1.5 w-24 bg-primary rounded-full mt-4"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
        {gpus.map((gpu) => (
          <div key={gpu.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${gpu.displayId * 100}ms` }}>
            {(gpu.displayId || gpu.id) === 1
              ? <GPUCard id={gpu.displayId || gpu.id} name={gpu.name} />
              : <WeeklyGPUCard id={gpu.displayId || gpu.id} name={gpu.name} />
            }
          </div>
        ))}
      </div>
    </div>
  );
}