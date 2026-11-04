import type {Metadata} from 'next';
export const metadata:Metadata={title:{default:'CBGPU Admin',template:'%s | CBGPU Admin'},description:'CBGPU administration workspace',robots:{index:false,follow:false}};
export default function AdminLayout({children}:{children:React.ReactNode}){return children;}
