import React from 'react';

function App() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* Sidebar (แถบเมนูด้านซ้าย) */}
      <div className="w-64 bg-white shadow-lg hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-blue-600">SmartMatch</h1>
          <p className="text-sm text-gray-400">AI Internship System</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="block p-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg">🏠 ภาพรวม</a>
          <a href="#" className="block p-3 bg-blue-50 text-blue-600 font-medium rounded-lg">💼 ค้นหางาน (AI Match)</a>
          <a href="#" className="block p-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg">📝 บันทึก Logbook</a>
        </nav>
      </div>

      {/* Main Content (พื้นที่หลัก) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header (แถบด้านบน) */}
        <header className="flex justify-between items-center p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800">ค้นหาสถานประกอบการ</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-600">สวัสดี, ชวณวิชญ์</span>
            <button className="px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50">ออกจากระบบ</button>
          </div>
        </header>

        {/* Content Area (การ์ดแนะนำงาน) */}
        <main className="flex-1 p-6 overflow-y-auto flex justify-center items-center">
          
          {/* Job Card (กล่องการ์ด) */}
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-blue-600 p-6 text-white text-center relative">
              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full shadow">
                AI Match: 85%
              </div>
              <h3 className="text-2xl font-bold mt-2">Fullstack Developer Intern</h3>
              <p className="opacity-80 mt-1">บริษัท Tech Startup Co., Ltd.</p>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-500 uppercase">ทักษะที่ตรงกับคุณ (Match)</h4>
                <div className="flex gap-2 mt-2">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">React</span>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">Golang</span>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase">ทักษะที่ต้องพัฒนาเพิ่ม (Gap)</h4>
                <div className="flex gap-2 mt-2">
                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">Docker (Level 2)</span>
                </div>
              </div>

              <div className="flex justify-between gap-4">
                <button className="flex-1 py-3 text-gray-500 font-bold border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition">
                  ❌ ข้ามไปก่อน
                </button>
                <button className="flex-1 py-3 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition">
                  💖 สมัครเลย
                </button>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

export default App;