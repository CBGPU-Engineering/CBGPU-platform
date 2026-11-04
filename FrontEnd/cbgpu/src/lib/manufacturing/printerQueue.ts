type QueuedJob={status:string;printer_id?:number|null;preferred_printer_id?:number|null;created_at?:string|null};
/** A requested printer is mandatory; legacy unspecified jobs are not a shared queue. */
export function queuedPrintJobsForPrinter<T extends QueuedJob>(jobs:T[],printerId:number|null|undefined):T[]{
 if(printerId==null)return [];
 return jobs.filter(job=>job.status==='accepted'&&job.printer_id==null&&job.preferred_printer_id===printerId).sort((a,b)=>new Date(a.created_at||0).getTime()-new Date(b.created_at||0).getTime());
}
