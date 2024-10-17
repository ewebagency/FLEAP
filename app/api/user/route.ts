
export async function GET() {
    const data = [
        {id:1, name:'Leanne Graham', email:'Sincere@april.biz'},
        {id:2, name:'Ervin Howell', email:'Shanna@melissa.tv'},
        {id:2, name:'Ervknckjnin Howell', email:'Shanna@melissa.tv'},
    ]
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }