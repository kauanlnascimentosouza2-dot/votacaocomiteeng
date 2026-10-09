// Paginação estável evita truncar contagens quando o histórico passa de 1.000 votos.
export async function readAllRows<T>(page:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>){
  const rows:T[]=[];
  for(let from=0;;from+=500){
    const {data,error}=await page(from,from+499);
    if(error)return {data:null,error};
    rows.push(...(data??[]));
    if(!data||data.length<500)return {data:rows,error:null};
  }
}
