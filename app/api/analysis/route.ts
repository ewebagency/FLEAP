export async function GET() {
    
    const data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [
        {
          id:1,
          label: 'DIB',
          data: [30, 50, 60, 40, 70, 80, 90],
          backgroundColor: 'rgba(75, 192, 192, 0.5)',
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 3
        },
        {
          id:2,
          label: 'Dangereux',
          data: [20, 30, 50, 20, 40, 60, 80],
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          borderColor: 'rgba(255, 159, 64, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 5
        },
        {
          id:3,
          label: 'Verre',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(153, 102, 255, 0.5)',
          borderColor: 'rgba(153, 102, 255, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 8
        },
        {
          id:4,
          label: 'Carton & Papier',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(153, 123, 123, 0.5)',
          borderColor: 'rgba(153, 123, 123, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 2
        },
        {
          id:5,
          label: 'Plastiques',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(123, 102, 255, 0.5)',
          borderColor: 'rgba(123, 102, 255, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 9
        },
        {
          id:6,
          label: 'DEEE',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(153, 0, 255, 0.5)',
          borderColor: 'rgba(153, 0, 255, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 1
        },
        {
          id:7,
          label: 'Métaux',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(153, 102, 0, 0.5)',
          borderColor: 'rgba(153, 102, 0, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 0
        },
        {
          id:8,
          label: 'Bois',
          data: [10, 20, 30, 10, 30, 40, 50],
          backgroundColor: 'rgba(0, 102, 255, 0.5)',
          borderColor: 'rgba(0, 102, 255, 1)',
          fill: true, // Remplissage sous la courbe
          remplissage : [0.8, 0.9, 0.75, 0.95, 0.8, 0.9, 0.75],
          declassement : 8
        },
      ],
    };

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  