import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  UploadCloud, Layers, Cpu, Box, Settings, LogOut, 
  ChevronRight, CheckCircle2, Loader2, Maximize2, 
  Download, Image as ImageIcon, Play, Eye,
  Network, Camera, Move3D, Sparkles, PaintBucket, FileOutput, Scan, Wand2,
  Filter, ImagePlus, Combine, Activity, Hexagon, Crosshair, ArrowDown, Target, Zap, ShieldCheck, Database, Menu, X,
  Info, Compass, MapPin, Check, FileArchive, MonitorPlay
} from 'lucide-react';

// --- Global State & Context ---
const AppContext = createContext();

// --- Theme & Style Constants ---
const theme = {
  bg: '#05050A',       
  text: '#FFFFFF',
  muted: '#8A93A6',
  primary: '#FF4B4B',  
  accent: '#1DF29F',   
  cyan: '#0EA5E9',     
  purple: '#8A2BE2'    
};

const liquidGlass = "bg-[#0A0B10]/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]";
const interactiveCard = "bg-black/50 backdrop-blur-3xl border border-white/10 shadow-[0_16px_64px_rgba(0,0,0,0.8)] cursor-default";

// --- REAL BACKEND API INTEGRATION ---
const API_BASE_URL = import.meta.env.VITE_API_URL;

const API = {
  createJob: async (method) => {
    const response = await fetch(`${API_BASE_URL}/jobs/?method=${method}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to create job');
    return response.json();
  },

  uploadImages: async (jobId, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append("files", file); 
    });

    const response = await fetch(`${API_BASE_URL}/upload/upload/image/${jobId}`, {
      method: 'POST',
      body: formData, 
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to upload images');
    }
    return response.json();
  },

  startJob: async (jobId) => {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/start`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to start job');
    }
    return response.json();
  },

  getJobStatus: async (jobId) => {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Failed to fetch job status');
    return response.json();
  }
};

// --- Gemini API Utility ---
const generateGeminiText = async (prompt) => {
  const apiKey = ""; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "You are an expert 3D reconstruction AI assistant built into the ORCA application." }] }
  };

  const fetchWithBackoff = async (retries = 5, delay = 1000) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithBackoff(retries - 1, delay * 2);
      } else {
        return "Warning: Failed to connect to ORCA AI advisory services.";
      }
    }
  };

  return fetchWithBackoff();
};

// --- Custom Physics Cursor ---
const CustomCursor = () => {
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) return;
    const handleMouseMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    const handleMouseOver = (e) => {
      const target = e.target;
      setIsHovering(
        target.tagName.toLowerCase() === 'button' || 
        target.tagName.toLowerCase() === 'a' || 
        target.closest('button') || 
        target.closest('a') ||
        target.closest('.interactive-target')
      );
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  if (typeof window !== 'undefined' && window.innerWidth < 768) return null;

  return (
    <motion.div 
      className="fixed top-0 left-0 w-8 h-8 rounded-full border-2 border-[#FF4B4B] pointer-events-none z-[99999] flex items-center justify-center mix-blend-screen"
      animate={{ 
        x: mousePos.x - 16, 
        y: mousePos.y - 16,
        scale: isHovering ? 1.8 : 1,
        backgroundColor: isHovering ? 'rgba(255, 75, 75, 0.2)' : 'rgba(0,0,0,0)'
      }}
      transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
    >
      <motion.div 
        className="w-1.5 h-1.5 bg-[#FF4B4B] rounded-full"
        animate={{ scale: isHovering ? 0 : 1 }}
      />
    </motion.div>
  );
};

// --- 3D Interactive Tilt Card ---
const TiltCard = ({ children, className, glowColor }) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotateX(-((y - centerY) / centerY) * 10);
    setRotateY(((x - centerX) / centerX) * 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY, scale: rotateX ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{ perspective: 1000 }}
      className={`relative group w-full interactive-target ${className}`}
    >
      <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl ${glowColor}`} />
      <div className={`${interactiveCard} relative z-10 w-full h-full p-8 md:p-12 rounded-3xl`}>
        {children}
      </div>
    </motion.div>
  );
};

// --- UNIVERSAL LOCAL ASSET VIEWER (Supports PLY, GLTF, OBJ, Point Clouds) ---
const UniversalViewer = ({ fileUrl, fileExt }) => {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [renderMode, setRenderMode] = useState('solid'); // 'solid' | 'points'
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const modelGroupRef = useRef(null);
  const animFrameRef = useRef(null);

  const wireframeRef = useRef(wireframe);
  const autoRotateRef = useRef(autoRotate);
  const renderModeRef = useRef(renderMode);

  useEffect(() => { wireframeRef.current = wireframe; }, [wireframe]);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);
  useEffect(() => { renderModeRef.current = renderMode; }, [renderMode]);

  // Init Scene
  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.update();
      }

      // Dynamically sync rendering modes
      if (modelGroupRef.current) {
        modelGroupRef.current.traverse((child) => {
          if (child.isMesh) {
            child.material.wireframe = wireframeRef.current;
            child.visible = renderModeRef.current === 'solid';
          }
          if (child.isPoints) {
            child.visible = renderModeRef.current === 'points';
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Load Model based on Ext
  useEffect(() => {
    if (!fileUrl || !sceneRef.current) return;
    setIsLoading(true);
    setLoadError(false);

    if (modelGroupRef.current) {
        sceneRef.current.remove(modelGroupRef.current);
        modelGroupRef.current = null;
    }

    const scene = sceneRef.current;

    const handleGeometry = (geometry) => {
        // Detect if it's a pure point cloud (no faces)
        const isPointCloudOnly = geometry.index === null && !geometry.attributes.normal;
        if (isPointCloudOnly) {
            setRenderMode('points');
        } else {
            geometry.computeVertexNormals();
        }
        
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
        
        const size = geometry.boundingBox.getSize(new THREE.Vector3()).length();
        const scale = 3.0 / (size === 0 ? 1 : size);
        
        const group = new THREE.Group();
        
        if (!isPointCloudOnly) {
            const meshMat = new THREE.MeshStandardMaterial({ color: '#8A2BE2', roughness: 0.4, metalness: 0.2 });
            const mesh = new THREE.Mesh(geometry, meshMat);
            group.add(mesh);
        }
        
        const ptsMat = new THREE.PointsMaterial({ color: '#0EA5E9', size: 0.02 });
        const pts = new THREE.Points(geometry, ptsMat);
        group.add(pts);
        
        group.scale.set(scale, scale, scale);
        scene.add(group);
        modelGroupRef.current = group;
        setIsLoading(false);
    };

    const handleGroup = (loadedGroup) => {
        const box = new THREE.Box3().setFromObject(loadedGroup);
        const center = box.getCenter(new THREE.Vector3());
        loadedGroup.position.sub(center);
        const size = box.getSize(new THREE.Vector3()).length();
        const scale = 3.0 / (size === 0 ? 1 : size);
        
        const wrapper = new THREE.Group();
        wrapper.add(loadedGroup);
        wrapper.scale.set(scale, scale, scale);

        const pointsToAdd = [];
        loadedGroup.traverse((child) => {
            if (child.isMesh) {
                // Ensure basic materials load cleanly
                if (!child.material) {
                     child.material = new THREE.MeshStandardMaterial({ color: '#8A2BE2' });
                } else if (Array.isArray(child.material)) {
                     child.material.forEach(m => { m.roughness = 0.4; m.metalness = 0.2; });
                } else {
                     child.material.roughness = 0.4;
                     child.material.metalness = 0.2;
                }

                const ptsMat = new THREE.PointsMaterial({ color: '#0EA5E9', size: 0.02 });
                const pts = new THREE.Points(child.geometry, ptsMat);
                pts.position.copy(child.position);
                pts.rotation.copy(child.rotation);
                pts.scale.copy(child.scale);
                pointsToAdd.push({ parent: child.parent, pts });
            }
        });
        pointsToAdd.forEach(({parent, pts}) => parent.add(pts));

        scene.add(wrapper);
        modelGroupRef.current = wrapper;
        setIsLoading(false);
    };

    const onError = (err) => {
        console.error(err);
        setLoadError(true);
        setIsLoading(false);
    };

    try {
        if (fileExt === 'ply') {
            new PLYLoader().load(fileUrl, handleGeometry, undefined, onError);
        } else if (fileExt === 'gltf' || fileExt === 'glb') {
            new GLTFLoader().load(fileUrl, (gltf) => handleGroup(gltf.scene), undefined, onError);
        } else if (fileExt === 'obj') {
            new OBJLoader().load(fileUrl, handleGroup, undefined, onError);
        } else {
            setLoadError(true);
            setIsLoading(false);
        }
    } catch(e) {
        onError(e);
    }

  }, [fileUrl, fileExt]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className={`w-full h-full relative flex items-center justify-center bg-black/50 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100000] rounded-none' : ''}`}>
      <div className="absolute top-6 right-6 z-20 flex flex-wrap justify-end gap-3 max-w-[70%]">
        <div className="flex bg-black/50 border border-white/10 rounded-xl overflow-hidden p-1">
            <button onClick={() => setRenderMode('solid')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${renderMode === 'solid' ? 'bg-[#8A2BE2] text-white' : 'text-[#8A93A6] hover:text-white'}`}>Solid</button>
            <button onClick={() => setRenderMode('points')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${renderMode === 'points' ? 'bg-[#0EA5E9] text-white' : 'text-[#8A93A6] hover:text-white'}`}>Points</button>
        </div>
        <button onClick={() => setWireframe(!wireframe)} disabled={renderMode === 'points'} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${wireframe ? 'bg-[#FF4B4B] text-white border-[#FF4B4B]' : 'bg-black/50 text-[#8A93A6] border-white/10 hover:border-[#FF4B4B]'} disabled:opacity-30 disabled:hover:border-white/10`}>Wireframe</button>
        <button onClick={() => setAutoRotate(!autoRotate)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${autoRotate ? 'bg-white text-black border-white' : 'bg-black/50 text-[#8A93A6] border-white/10 hover:border-white'}`}>Rotate</button>
        <button onClick={toggleFullscreen} className="p-2 bg-black/50 border border-white/10 text-white rounded-xl hover:bg-white hover:text-black transition-colors"><Maximize2 size={16} /></button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-8 text-center bg-[#05050A]/80 backdrop-blur-md">
           <Loader2 size={40} className="text-[#8A2BE2] animate-spin mb-4" />
           <p className="text-white font-black tracking-widest text-sm uppercase">Loading Asset...</p>
           <p className="text-[#8A93A6] text-[10px] uppercase tracking-widest mt-2 font-mono">Parsing Geometry Data</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-8 text-center bg-[#05050A]/80 backdrop-blur-md">
          <Box size={48} className="text-[#FF4B4B] mb-6 opacity-80" />
          <p className="text-white font-black tracking-widest text-lg mb-3 uppercase">Parsing Failed</p>
          <p className="text-[#8A93A6] text-xs font-mono max-w-md leading-relaxed">
            Could not read the provided file. Make sure it's a valid standard 3D format (.ply, .obj, .glb, .gltf).
          </p>
        </div>
      )}
    </div>
  );
};


// --- ORCA Backend PLY Viewer Component (For Pipeline Outputs) ---
const PlyViewer = ({ jobId, isCompleted }) => {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const meshRef = useRef(null);
  const loadingMeshRef = useRef(null);
  const animFrameRef = useRef(null);

  const wireframeRef = useRef(wireframe);
  const autoRotateRef = useRef(autoRotate);

  useEffect(() => { wireframeRef.current = wireframe; }, [wireframe]);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const fallbackGeo = new THREE.IcosahedronGeometry(1.5, 4);
    const fallbackMat = new THREE.PointsMaterial({ color: '#0EA5E9', size: 0.02, transparent: true, opacity: 0.6 });
    const fallbackMesh = new THREE.Points(fallbackGeo, fallbackMat);
    scene.add(fallbackMesh);
    loadingMeshRef.current = fallbackMesh;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.update();
      }

      if (loadingMeshRef.current && !meshRef.current) {
        loadingMeshRef.current.rotation.y += 0.01;
        loadingMeshRef.current.rotation.x += 0.005;
      }

      if (meshRef.current && meshRef.current.material) {
        meshRef.current.material.wireframe = wireframeRef.current;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (isCompleted && jobId && sceneRef.current && !meshRef.current) {
      const loader = new PLYLoader();
      const meshUrl = `${API_BASE_URL}/outputs/${jobId}/final_mesh.ply`;

      loader.load(meshUrl, (geometry) => {
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ 
          color: '#1DF29F', roughness: 0.4, metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        mesh.position.sub(center);
        
        const size = geometry.boundingBox.getSize(new THREE.Vector3()).length();
        const scale = 3.0 / size;
        mesh.scale.set(scale, scale, scale);

        if (loadingMeshRef.current) {
          sceneRef.current.remove(loadingMeshRef.current);
        }
        sceneRef.current.add(mesh);
        meshRef.current = mesh;
      }, undefined, (err) => {
        console.warn("Failed to load PLY:", err);
        setLoadError(true);
        if (loadingMeshRef.current) {
          loadingMeshRef.current.material.color.setHex(0xFF4B4B); 
        }
      });
    }
  }, [isCompleted, jobId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className={`w-full h-full relative flex items-center justify-center bg-[#05050A] rounded-3xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100000] rounded-none' : ''}`}>
      <div className="absolute top-6 right-6 z-20 flex gap-3">
        <button onClick={() => setWireframe(!wireframe)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${wireframe ? 'bg-[#FF4B4B] text-white border-[#FF4B4B]' : 'bg-black/50 text-[#8A93A6] border-white/10 hover:border-[#FF4B4B]'}`}>Wireframe</button>
        <button onClick={() => setAutoRotate(!autoRotate)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${autoRotate ? 'bg-[#1DF29F] text-black border-[#1DF29F]' : 'bg-black/50 text-[#8A93A6] border-white/10 hover:border-[#1DF29F]'}`}>Rotate</button>
        <button onClick={toggleFullscreen} className="p-2 bg-black/50 border border-white/10 text-white rounded-xl hover:bg-white hover:text-black transition-colors"><Maximize2 size={16} /></button>
      </div>

      {(!isCompleted && !loadError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-8 text-center bg-black/20 backdrop-blur-sm">
           <Loader2 size={40} className="text-[#0EA5E9] animate-spin mb-4" />
           <p className="text-white font-black tracking-widest text-sm uppercase">Synthesizing Mesh...</p>
           <p className="text-[#8A93A6] text-[10px] uppercase tracking-widest mt-2 font-mono">Awaiting COLMAP Final Output</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none p-8 text-center bg-black/60 backdrop-blur-sm">
          <Box size={48} className="text-[#FF4B4B] mb-6 opacity-80" />
          <p className="text-white font-black tracking-widest text-lg mb-3 uppercase">Asset Routing Required</p>
          <p className="text-[#8A93A6] text-xs font-mono max-w-md leading-relaxed">
            To view the actual <strong className="text-white">.ply</strong> mesh, your FastAPI backend must mount the outputs folder statically. Add this to <strong className="text-[#1DF29F]">main.py</strong>:
            <br/><br/>
            <code className="text-[#1DF29F] bg-black/80 border border-white/10 p-3 rounded-xl block text-left shadow-lg">
              from fastapi.staticfiles import StaticFiles<br/>
              app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")
            </code>
          </p>
        </div>
      )}
    </div>
  );
};

// --- 11 Stage Pipeline Explainer Content Data ---
const PIPELINE_STAGES = [
  { id: 1, title: 'Image Capture', desc: 'Guided Acquisition', detail: 'Mobile camera and IMU sensors track orientation to capture multiple views without topological blindspots.', components: [{n: 'IMU Guiding', d: 'Gyroscope UI ensures 360-degree overlap.', icon: Compass}, {n: 'Auto-Capture', d: 'Triggers shutter on stability to prevent blur.', icon: Camera}, {n: 'EXIF Pack', d: 'Extracts intrinsic focal length data.', icon: Settings}], icon: Camera },
  { id: 2, title: 'Preprocessing', desc: 'Signal optimization', detail: 'Raw fragments undergo automated QC. Gaussian filters reduce noise while Laplacian variances flag blur.', components: [{n: 'Denoising', d: 'High-pass filtering clears signal noise.', icon: Filter}, {n: 'QC Hash', d: 'Cryptographic hashing removes duplicates.', icon: Database}, {n: 'Exposure', d: 'Normalizes exposure across datasets.', icon: Eye}], icon: Filter },
  { id: 3, title: 'Feature Detect', desc: 'Isolating Keypoints', detail: 'Scans matrices to identify Scale-Invariant corners and edges using SIFT.', components: [{n: 'Extrema', d: 'Locates gradient extremas for anchors.', icon: Target}, {n: 'SIFT Keys', d: 'Calculates invariant 128D descriptors.', icon: Scan}, {n: 'Pyramid', d: 'Multi-scale depth-independent tracking.', icon: Layers}], icon: Scan },
  { id: 4, title: 'Matching', desc: 'Cross-Image Links', detail: 'Nearest neighbor algorithms link keypoints. RANSAC rejects outliers.', components: [{n: 'Linking', d: 'Maps correspondence using FLANN.', icon: Combine}, {n: 'RANSAC', d: 'Strict outlier rejection algorithm.', icon: Filter}, {n: 'Epipolar', d: 'Stereo-view constraint validation.', icon: Network}], icon: Combine },
  { id: 5, title: 'SfM', desc: 'Pose Estimation', detail: 'Triangulates points to solve for exact camera poses and virtual rays.', components: [{n: 'Poses', d: 'Calculates 6-DOF spatial location vectors.', icon: Crosshair}, {n: 'Frustums', d: 'Solves individual Field of View projections.', icon: Camera}, {n: 'Bundle Adj', d: 'Minimizes global reprojection errors.', icon: Settings}], icon: Network },
  { id: 6, title: 'Sparse Cloud', desc: 'Geometric Anchors', detail: 'A constellation of 3D coordinates defining the rough boundary.', components: [{n: 'Vertices', d: 'Locks 3D coordinate intersections.', icon: MapPin}, {n: 'Visibility', d: 'Point-to-image visibility graphs.', icon: Network}, {n: 'Cloud Base', d: 'Low-density structural mesh root.', icon: Sparkles}], icon: Sparkles },
  { id: 7, title: 'Dense Reconstruct', desc: 'MVS Generation', detail: 'Patch-Match stereo computes deep maps, multiplying the cloud.', components: [{n: 'Depth Map', d: 'Estimates precise Z-axis parallax distances.', icon: Layers}, {n: 'Stereo MVS', d: 'Multi-View Stereo gap filling.', icon: ImagePlus}, {n: 'Fusion', d: 'Aggregates maps into unified cloud.', icon: Combine}], icon: Layers },
  { id: 8, title: 'Mesh Gen', desc: 'Surface Poisson', detail: 'The Poisson equation envelops the cloud in a continuous surface.', components: [{n: 'Poisson Eq', d: 'Solves implicit surface functions.', icon: Hexagon}, {n: 'Polygons', d: 'Generates connected triangle meshes.', icon: Box}, {n: 'Normals', d: 'Calculates surface orientation vectors.', icon: Move3D}], icon: Box },
  { id: 9, title: 'Alignment', desc: 'Global ICP', detail: 'Broken fragment meshes are aligned into a common frame.', components: [{n: 'ICP Refine', d: 'Iterative Closest Point minimization.', icon: Target}, {n: 'Global Reg', d: 'FPFH coarse feature alignment.', icon: Network}, {n: 'Transforms', d: 'Rigid matrix rotations and translations.', icon: Move3D}], icon: Move3D },
  { id: 10, title: 'AI Completion', desc: 'Generative Repair', detail: 'Neural networks infer missing geometry between fragments.', components: [{n: 'Neural Fill', d: 'AI generative completion of missing topology.', icon: Sparkles}, {n: 'Decimation', d: 'Quadric Error Metrics polygon optimization.', icon: Activity}, {n: 'Smoothing', d: 'Laplacian curvature-aware noise reduction.', icon: Wand2}], icon: Wand2 },
  { id: 11, title: 'Final Artifact', desc: 'Export Ready', detail: 'The final 3D object is optimized and rendered interactively.', components: [{n: 'UV Baking', d: 'Projects photographic color data atlas.', icon: PaintBucket}, {n: 'WebGL', d: 'Interactive browser-native 3D render.', icon: Eye}, {n: 'Transmission', d: 'Compiles final GLB / OBJ assets.', icon: FileOutput}], icon: FileOutput }
];

// --- 3D Explainer Scene Controller ---
const InteractivePipeline3D = ({ scrollYProgress, hasStarted, activeTrigger }) => {
  const mountRef = useRef(null);
  const effects = useRef({ flash: 0, scan: 0, pulse: 0, spin: 0, jitter: 0, glow: 0, captureAnim: 0 });

  useEffect(() => {
    if (!activeTrigger) return;
    const efx = effects.current;
    if (['Auto-Capture', 'IMU Guiding', 'EXIF Pack'].includes(activeTrigger)) {
      efx.flash = 1.0;
      efx.captureAnim = 1.0;
    }
    if (['Denoising', 'QC Hash', 'Exposure'].includes(activeTrigger)) efx.scan = 1.0;
    if (['Extrema', 'SIFT Keys', 'Pyramid', 'Linking', 'RANSAC', 'Epipolar'].includes(activeTrigger)) efx.pulse = 1.0;
    if (['Poses', 'Frustums', 'Bundle Adj'].includes(activeTrigger)) efx.spin = 1.0;
    if (['ICP Refine', 'Global Reg', 'Transforms'].includes(activeTrigger)) efx.jitter = 1.0;
    if (['Neural Fill', 'Decimation', 'Smoothing', 'UV Baking', 'WebGL', 'Transmission'].includes(activeTrigger)) efx.glow = 1.0;
  }, [activeTrigger]);

  useEffect(() => {
    if (!mountRef.current) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(theme.bg, 0.05);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
    scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(theme.primary, 8);
    dirLight1.position.set(10, 10, 10);
    scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(theme.cyan, 6);
    dirLight2.position.set(-10, -10, 10);
    scene.add(dirLight2);
    
    const pointLight = new THREE.PointLight(0xffffff, 5, 20); 
    pointLight.position.set(0, 0, 6);
    scene.add(pointLight);

    const cameraCount = window.innerWidth < 768 ? 10 : 20; 
    const maxRadius = 4.5;
    const camerasGroup = new THREE.Group();
    
    const frustumGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    frustumGeo.translate(0, 0.25, 0); frustumGeo.rotateX(Math.PI/2);
    const frustumMat = new THREE.MeshBasicMaterial({ color: theme.cyan, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    const rayMat = new THREE.LineBasicMaterial({ color: theme.purple, transparent: true, opacity: 0, depthWrite: false });

    const frustums = [];
    const rays = [];
    const imagePlanes = [];
    const featurePoints = [];
    const matchLines = new THREE.Group();
    
    const matchMat = new THREE.LineBasicMaterial({ color: theme.primary, transparent: true, opacity: 0, depthWrite: false });
    camerasGroup.add(matchLines);

    const planeGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xA0AEC0, wireframe: true, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    
    const scannerGeo = new THREE.PlaneGeometry(12, 12);
    const scannerMat = new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const scannerPlane = new THREE.Mesh(scannerGeo, scannerMat);
    scannerPlane.rotation.x = Math.PI / 2;
    scannerPlane.visible = false;
    scene.add(scannerPlane);

    for (let i = 0; i < cameraCount; i++) {
      const theta = (i / cameraCount) * Math.PI * 2;
      const phi = Math.acos(-1 + (2 * i) / cameraCount); 
      
      const x = maxRadius * Math.sin(phi) * Math.cos(theta);
      const y = maxRadius * Math.sin(phi) * Math.sin(theta);
      const z = maxRadius * Math.cos(phi);

      const plane = new THREE.Mesh(planeGeo, planeMat.clone());
      plane.position.set(0, 0, 0); 
      plane.lookAt(0, 0, 0);
      imagePlanes.push({ mesh: plane, targetPos: new THREE.Vector3(x,y,z), baseCol: 0x8A93A6 });
      camerasGroup.add(plane);

      const ptGeo = new THREE.BufferGeometry();
      const ptArray = new Float32Array(15); 
      for(let j=0; j<15; j++) ptArray[j] = (Math.random() - 0.5) * 0.4;
      ptGeo.setAttribute('position', new THREE.BufferAttribute(ptArray, 3));
      const ptMat = new THREE.PointsMaterial({ color: theme.primary, size: 0.06, transparent: true, opacity: 0, depthWrite: false });
      const pt = new THREE.Points(ptGeo, ptMat);
      plane.add(pt);
      featurePoints.push(pt);

      const frustum = new THREE.Mesh(frustumGeo, frustumMat.clone());
      frustum.position.set(0, 0, 0); 
      frustum.lookAt(0, 0, 0);
      frustums.push({ mesh: frustum, targetPos: new THREE.Vector3(x,y,z) });
      camerasGroup.add(frustum);

      const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0)]);
      const ray = new THREE.Line(rayGeo, rayMat.clone());
      rays.push(ray);
      camerasGroup.add(ray);

      if (i > 0) {
        const prevTarget = imagePlanes[i-1].targetPos;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([prevTarget, new THREE.Vector3(x,y,z)]);
        const line = new THREE.Line(lineGeo, matchMat.clone());
        matchLines.add(line);
      }
    }
    scene.add(camerasGroup);

    const targetGeo = new THREE.IcosahedronGeometry(0.8, 2);
    const targetMat = new THREE.MeshStandardMaterial({ color: '#A0AEC0', roughness: 0.5, metalness: 0.5, transparent: true, opacity: 0, depthWrite: true });
    const targetMesh = new THREE.Mesh(targetGeo, targetMat);
    scene.add(targetMesh);

    const centerGroup = new THREE.Group();
    const coreGeo = new THREE.TorusKnotGeometry(1.4, 0.45, 250, 48); 
    const sparseGeo = new THREE.TorusKnotGeometry(1.4, 0.45, 60, 10); 
    const fragGeo = new THREE.TorusKnotGeometry(0.6, 0.25, 64, 16); 
    const patchGeo = new THREE.IcosahedronGeometry(1.85, 2); 
    
    const sparseMat = new THREE.PointsMaterial({ color: theme.cyan, size: 0.05, transparent: true, opacity: 0, depthWrite: false });
    const sparseMesh = new THREE.Points(sparseGeo, sparseMat);
    centerGroup.add(sparseMesh);

    const denseMat = new THREE.PointsMaterial({ color: theme.text, size: 0.02, transparent: true, opacity: 0, depthWrite: false });
    const denseMesh = new THREE.Points(coreGeo, denseMat);
    centerGroup.add(denseMesh);

    const wireMat = new THREE.MeshBasicMaterial({ color: theme.purple, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    const wireMesh = new THREE.Mesh(coreGeo, wireMat);
    centerGroup.add(wireMesh);

    const fragmentMat = new THREE.MeshStandardMaterial({ color: theme.primary, wireframe: true, transparent: true, opacity: 0, depthWrite: true });
    const fragmentMesh = new THREE.Mesh(fragGeo, fragmentMat);
    fragmentMesh.position.set(3, 2, -2);
    fragmentMesh.renderOrder = 1; 
    centerGroup.add(fragmentMesh);

    const patchMat = new THREE.MeshBasicMaterial({ color: theme.primary, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    const patchMesh = new THREE.Mesh(patchGeo, patchMat);
    centerGroup.add(patchMesh);

    const solidMat = new THREE.MeshPhysicalMaterial({ 
      color: '#CBD5E1', 
      roughness: 0.2, 
      metalness: 0.6, 
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      flatShading: true, 
      transparent: true, 
      opacity: 0,
      depthWrite: true
    });
    const solidMesh = new THREE.Mesh(coreGeo, solidMat);
    solidMesh.scale.set(0.98, 0.98, 0.98);
    solidMesh.renderOrder = 2; 
    solidMesh.visible = false;
    centerGroup.add(solidMesh);

    scene.add(centerGroup);

    const gridHelper = new THREE.GridHelper(50, 50, theme.border, theme.border);
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    let mouseX = 0; let mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
      mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const STAGE_COUNT = 11;
    const unsubscribeScroll = scrollYProgress.on('change', (latest) => {
      if (!hasStarted) return;
      
      const rawStage = latest * (STAGE_COUNT - 1); 
      
      const getOpacity = (stageIndex) => {
        const dist = Math.abs(rawStage - stageIndex);
        return THREE.MathUtils.clamp(1 - dist, 0, 1);
      };

      const imgOpacity = latest > 0.01 && latest < 0.25 ? Math.sin(((latest - 0.01) / 0.24) * Math.PI) : 0;
      const expansion = Math.min(1, Math.max(0, rawStage * 1.5)); 
      
      targetMesh.material.opacity = getOpacity(0);
      targetMesh.visible = targetMesh.material.opacity > 0.01;

      imagePlanes.forEach((p) => {
        p.mesh.material.opacity = imgOpacity * 0.5;
        p.mesh.position.lerpVectors(new THREE.Vector3(0,0,0), p.targetPos, expansion);
        p.mesh.lookAt(0,0,0);
      });

      const camOpacity = latest > 0.2 && latest < 0.4 ? Math.sin(((latest - 0.2) / 0.2) * Math.PI) : 0;
      frustums.forEach((f) => {
        f.mesh.material.opacity = camOpacity;
        f.mesh.position.copy(imagePlanes[0].mesh.position).lerpVectors(new THREE.Vector3(0,0,0), f.targetPos, expansion);
        f.mesh.lookAt(0,0,0);
      });
      rays.forEach(m => m.material.opacity = camOpacity * 0.6);

      featurePoints.forEach(pt => pt.material.opacity = getOpacity(2));
      matchLines.children.forEach(l => l.material.opacity = getOpacity(3));

      sparseMat.opacity = getOpacity(5);
      sparseMesh.visible = sparseMat.opacity > 0.01;

      denseMat.opacity = getOpacity(6);
      denseMesh.visible = denseMat.opacity > 0.01;

      wireMat.opacity = Math.max(getOpacity(7), getOpacity(8));
      wireMesh.visible = wireMat.opacity > 0.01;
      
      const alignProgress = Math.max(0, Math.min(1, rawStage - 7));
      fragmentMat.opacity = Math.max(getOpacity(8), getOpacity(9));
      fragmentMesh.visible = fragmentMat.opacity > 0.01;
      fragmentMesh.position.lerpVectors(new THREE.Vector3(3, 2, -2), new THREE.Vector3(0,0,0), alignProgress);
      fragmentMesh.rotation.x = alignProgress * Math.PI * 2;
      
      patchMat.opacity = getOpacity(9);
      patchMesh.visible = patchMat.opacity > 0.01;
      
      solidMat.opacity = Math.max(getOpacity(10), latest > 0.95 ? 1 : getOpacity(9) * 0.4);
      solidMesh.visible = solidMat.opacity > 0.01; 

      camera.position.z = 10 - (latest * 4); 
      centerGroup.rotation.y = latest * Math.PI * 2;
    });

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      scene.rotation.y += 0.05 * (mouseX - scene.rotation.y);
      scene.rotation.x += 0.05 * (mouseY - scene.rotation.x);
      
      centerGroup.rotation.x += 0.05 * (mouseY * 0.5 - centerGroup.rotation.x);
      camerasGroup.rotation.y += 0.05 * (mouseX - camerasGroup.rotation.y);

      camerasGroup.rotation.z -= 0.001;
      centerGroup.rotation.y += 0.002;
      targetMesh.rotation.y -= 0.005;

      const efx = effects.current;

      if (efx.captureAnim > 0.01) {
        efx.captureAnim *= 0.92;
        camerasGroup.rotation.y += efx.captureAnim * 0.3; 
        camerasGroup.scale.setScalar(1 - (efx.captureAnim * 0.2)); 
        targetMesh.scale.setScalar(1 + efx.captureAnim * 0.15); 
      } else {
        camerasGroup.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
        targetMesh.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
      }

      if (efx.flash > 0.01) {
        efx.flash *= 0.9;
        pointLight.intensity = 5 + efx.flash * 40;
        imagePlanes.forEach(p => { p.mesh.material.color.setHex(0xffffff); p.mesh.material.opacity = Math.max(0.5, efx.flash); });
      } else {
        pointLight.intensity = 5;
        imagePlanes.forEach(p => p.mesh.material.color.setHex(0x8A93A6));
      }

      if (efx.scan > 0.01) {
        efx.scan *= 0.95;
        scannerMat.opacity = efx.scan * 0.6;
        scannerPlane.position.y = Math.sin(Date.now() * 0.01) * 4;
        scannerPlane.visible = true;
      } else {
        scannerMat.opacity = 0;
        scannerPlane.visible = false;
      }

      if (efx.pulse > 0.01) {
        efx.pulse *= 0.9;
        featurePoints.forEach(pt => pt.material.size = 0.05 + efx.pulse * 0.3);
        matchLines.children.forEach(l => l.material.color.setHex(0xffffff));
      } else {
        featurePoints.forEach(pt => pt.material.size = 0.05);
        matchLines.children.forEach(l => l.material.color.setStyle(theme.primary));
      }

      if (efx.spin > 0.01) {
        efx.spin *= 0.95;
        camerasGroup.rotation.y += efx.spin * 0.2;
      }

      if (efx.jitter > 0.01) {
        efx.jitter *= 0.9;
        fragmentMesh.position.x += (Math.random() - 0.5) * efx.jitter * 0.5;
        fragmentMesh.material.color.setHex(0xffffff);
      } else {
        fragmentMesh.material.color.setStyle(theme.primary);
      }

      if (efx.glow > 0.01) {
        efx.glow *= 0.95;
        patchMesh.scale.setScalar(1 + efx.glow * 0.2);
        patchMesh.material.color.setHex(0xffffff);
      } else {
        patchMesh.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
        patchMesh.material.color.setStyle(theme.primary);
      }

      patchMesh.rotation.x += 0.01; 
      patchMesh.rotation.y -= 0.005;

      if (!hasStarted) {
        const time = Date.now() * 0.001;
        imagePlanes.forEach((p, i) => {
          p.mesh.material.opacity = 0.2;
          p.mesh.position.copy(p.targetPos);
          p.mesh.position.y += Math.sin(time + i) * 0.5;
        });
        centerGroup.rotation.y += 0.01;
        wireMat.opacity = 0.15; 
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      unsubscribeScroll();
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) mountRef.current.removeChild(renderer.domElement);
      
      planeGeo.dispose(); frustumGeo.dispose(); coreGeo.dispose(); sparseGeo.dispose(); fragGeo.dispose(); patchGeo.dispose(); scannerGeo.dispose(); targetGeo.dispose();
      planeMat.dispose(); frustumMat.dispose(); rayMat.dispose(); matchMat.dispose(); sparseMat.dispose(); denseMat.dispose(); wireMat.dispose(); fragmentMat.dispose(); patchMat.dispose(); solidMat.dispose(); scannerMat.dispose(); targetMat.dispose();
      featurePoints.forEach(pt => { pt.geometry.dispose(); pt.material.dispose(); });
      renderer.dispose();
    };
  }, [scrollYProgress, hasStarted]); 

  return <div ref={mountRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

// --- Left Taskbar Sidebar ---
const ExpandableSidebar = ({ activeStageId, scrollToStage, isPipelineActive }) => {
  if (!isPipelineActive) return null;
  return (
    <motion.nav className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col pointer-events-auto bg-[#05050A]/80 backdrop-blur-3xl rounded-3xl border border-white/10 p-2 shadow-[0_0_30px_rgba(0,0,0,0.8)] gap-1">
      {PIPELINE_STAGES.map((stage, idx) => (
        <button key={stage.id} onClick={() => scrollToStage(idx)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative group interactive-target ${activeStageId === stage.id ? 'bg-[#FF4B4B] text-white shadow-[0_0_15px_#FF4B4B]' : 'bg-transparent text-slate-500 hover:text-white hover:bg-white/10'}`}>
          <span className="text-[10px] font-black">{stage.id}</span>
          <span className={`absolute left-10 opacity-0 group-hover:opacity-100 ${liquidGlass} px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white whitespace-nowrap pointer-events-none transition-opacity duration-200`}>
             {stage.title}
          </span>
        </button>
      ))}
    </motion.nav>
  );
};

// --- Ultra-Compact Interactive HUD ---
const MiniHUD = ({ activeStageId, onAction }) => {
  const activeStageData = PIPELINE_STAGES.find(s => s.id === activeStageId) || PIPELINE_STAGES[0];
  const [hoveredComp, setHoveredComp] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const { navigate } = useContext(AppContext);

  useEffect(() => {
    const h = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h); 
    return () => window.removeEventListener('mousemove', h);
  }, []);

  const handleCompClick = (comp) => {
    setActiveAction(comp.n);
    onAction(comp.n); 
    setTimeout(() => setActiveAction(null), 800); 
  };

  return (
    <>
      <div className="fixed bottom-8 left-20 md:left-24 z-40 w-auto max-w-[280px] pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div key={activeStageId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{duration: 0.3}} className={`${liquidGlass} p-5 rounded-3xl pointer-events-auto border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.8)]`}>
            <div className="flex items-center justify-between mb-3 gap-4">
              <div className="inline-flex items-center gap-2 text-[#FF4B4B] font-mono text-[9px] uppercase tracking-widest bg-[#FF4B4B]/10 px-3 py-1 rounded-full border border-[#FF4B4B]/20">
                Stage {String(activeStageData.id).padStart(2, '0')}
              </div>
              <h2 className="text-sm font-black uppercase tracking-tighter text-white truncate">{activeStageData.title}</h2>
            </div>
            <p className="text-[#8A93A6] text-[10px] leading-relaxed mb-4 font-mono opacity-80">{activeStageData.desc}</p>
            
            <div className="flex flex-wrap gap-2">
              {activeStageData.components?.map((comp, i) => (
                <div 
                  key={i} 
                  onClick={() => handleCompClick(comp)}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl cursor-crosshair interactive-target transition-all relative ${activeAction === comp.n ? 'bg-[#FF4B4B] text-white scale-90 shadow-[0_0_20px_#FF4B4B]' : 'bg-black/50 border border-white/10 text-[#8A93A6] hover:border-[#FF4B4B]/50 hover:bg-[#FF4B4B]/10 hover:text-[#FF4B4B]'}`} 
                  onMouseEnter={() => setHoveredComp(comp)} 
                  onMouseLeave={() => setHoveredComp(null)}
                >
                  {activeAction === comp.n && <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 bg-[#FF4B4B] rounded-lg pointer-events-none" />}
                  {comp.icon ? <comp.icon size={16} /> : <Info size={16}/>}
                </div>
              ))}
            </div>

            {activeStageData.id === 11 && (
              <button onClick={() => navigate('dashboard')} className="mt-5 w-full py-3 bg-[#FF4B4B] text-white font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-colors shadow-[0_0_15px_rgba(255,75,75,0.3)] interactive-target">
                Access Console
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {hoveredComp && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} style={{ left: mousePos.x + 15, top: mousePos.y - 70 }} className="fixed z-[1000] pointer-events-none bg-[#11121A] text-white p-4 shadow-[0_0_30px_rgba(255,75,75,0.3)] rounded-2xl border border-[#FF4B4B]/30 max-w-[240px]">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-[#FF4B4B] mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4B4B] animate-pulse"/>
              {hoveredComp.n}
            </h4>
            <p className="text-[10px] font-mono text-[#8A93A6] leading-relaxed">{hoveredComp.d}</p>
            <div className="text-[8px] font-bold text-[#1DF29F] uppercase tracking-widest mt-3 opacity-70">&gt; Click icon to run</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// --- Footer Component ---
const Footer = () => (
  <div className="absolute bottom-0 w-full py-10 text-center text-[10px] font-mono text-[#6C7486] uppercase tracking-widest border-t border-white/5 bg-[#05050A]/80 backdrop-blur-xl z-50">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center px-12 opacity-80">
      <div className="flex items-center gap-3 mb-6 md:mb-0"><Box size={14} className="text-[#FF4B4B]"/> ORCA Core Engine v2.0</div>
      <div className="space-x-8">
        <span className="hover:text-white cursor-pointer transition-colors">Documentation</span>
        <span className="hover:text-white cursor-pointer transition-colors">API Reference</span>
        <span className="hover:text-[#1DF29F] cursor-pointer transition-colors inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#1DF29F] animate-pulse"/> System Status</span>
      </div>
    </div>
  </div>
);

// --- Landing Controller ---
const LandingRoot = () => {
  const containerRef = useRef(null);
  const { navigate } = useContext(AppContext);
  const [viewMode, setViewMode] = useState('doc'); 
  const [activeStageId, setActiveStageId] = useState(1);
  const [activeTrigger, setActiveTrigger] = useState(null);

  // Explicit offset ensures Framer Motion calculates correctly, preventing the offset warning
  const { scrollYProgress } = useScroll({ 
    target: containerRef,
    offset: ["start start", "end end"] 
  });
  
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25, restDelta: 0.001 });

  useEffect(() => {
    if (viewMode !== 'pipeline') return;
    const unsub = smoothProgress.on('change', (v) => {
      const idx = Math.min(10, Math.floor(v * 11));
      setActiveStageId(idx + 1);
    });
    return unsub;
  }, [smoothProgress, viewMode]);

  // Document Opacity Map
  const hOp = useTransform(smoothProgress, [0, 0.15], [1, 0]);
  const hDisplay = useTransform(hOp, v => v > 0.01 ? "block" : "none");

  const pOpIn = useTransform(smoothProgress, [0.1, 0.25], [0, 1]);
  const pOpOut = useTransform(smoothProgress, [0.35, 0.45], [1, 0]);
  const pOp = useTransform([pOpIn, pOpOut], ([inVal, outVal]) => Math.min(inVal, outVal === 0 ? 0 : 1));
  const pDisplay = useTransform(pOp, v => v > 0.01 ? "block" : "none");

  const oOpIn = useTransform(smoothProgress, [0.4, 0.55], [0, 1]);
  const oOpOut = useTransform(smoothProgress, [0.65, 0.75], [1, 0]);
  const oOp = useTransform([oOpIn, oOpOut], ([inVal, outVal]) => Math.min(inVal, outVal === 0 ? 0 : 1));
  const oDisplay = useTransform(oOp, v => v > 0.01 ? "block" : "none");

  const aOp = useTransform(smoothProgress, [0.7, 0.85], [0, 1]);
  const aDisplay = useTransform(aOp, v => v > 0.01 ? "block" : "none");

  const handleExecutePipeline = () => {
    window.scrollTo(0, 0);
    setViewMode('pipeline');
  };

  const scrollToStage = (index) => {
    if (!containerRef.current) return;
    const scrollPx = (index / 11) * (containerRef.current.scrollHeight - window.innerHeight);
    window.scrollTo({ top: scrollPx, behavior: 'smooth' });
  };

  const headerPadding = useTransform(smoothProgress, [0, 0.2], ["1.5rem", "2rem"]);

  return (
    <div ref={containerRef} style={{ height: viewMode === 'pipeline' ? '3000vh' : '500vh' }} className="relative text-white selection:bg-[#FF4B4B]/30 font-sans bg-transparent">
      <CustomCursor />
      
      {viewMode === 'pipeline' && <div className="fixed inset-0 flex items-center justify-center text-[#8A93A6] text-xs font-mono tracking-widest bg-black/80 z-0"></div>}
      
      <InteractivePipeline3D scrollYProgress={smoothProgress} hasStarted={viewMode === 'pipeline'} activeTrigger={activeTrigger} />
      
      <motion.nav style={{ paddingBottom: headerPadding, paddingTop: headerPadding }} className={`fixed w-full top-0 left-0 z-50 flex items-center justify-between px-8 ${liquidGlass} rounded-b-3xl border-t-0 pointer-events-auto`}>
        <div className="flex-1 flex justify-start">
          <div className="text-2xl font-black tracking-tighter flex items-center gap-3 cursor-pointer hover:text-[#FF4B4B] transition-colors" onClick={() => { setViewMode('doc'); window.scrollTo(0,0); }}>
            <div className="w-10 h-10 bg-[#FF4B4B] rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,75,75,0.4)]">
              <Box size={18} />
            </div>
            <span>ORCA</span>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          {viewMode === 'doc' && (
             <button onClick={handleExecutePipeline} className="hidden md:flex items-center gap-3 px-8 py-3 bg-[#FF4B4B] text-white rounded-full font-bold uppercase tracking-widest text-[11px] hover:bg-white hover:text-black transition-all shadow-[0_0_20px_rgba(255,75,75,0.4)] interactive-target hover:scale-105">
                <Play size={14} className="fill-current" /> Execute Pipeline
             </button>
          )}
        </div>
        <div className="flex-1 flex justify-end">
          <button onClick={() => navigate('dashboard')} className="px-8 py-3 border border-[#FF4B4B] text-[#FF4B4B] rounded-full font-bold uppercase tracking-widest text-[11px] hover:bg-[#FF4B4B] hover:text-white transition-all shadow-[0_0_15px_rgba(255,75,75,0.2)] interactive-target hover:scale-105">
            Console
          </button>
        </div>
      </motion.nav>

      {viewMode === 'pipeline' && (
        <>
          <ExpandableSidebar activeStageId={activeStageId} scrollToStage={scrollToStage} isPipelineActive={true} />
          <MiniHUD activeStageId={activeStageId} onAction={(action) => setActiveTrigger(action)} />
        </>
      )}

      {viewMode === 'doc' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <motion.div style={{ opacity: hOp, display: hDisplay }} className="absolute w-[90%] md:w-[600px] pointer-events-auto">
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">ORCA</h1>
            <h2 className="text-xs md:text-sm text-[#1DF29F] font-mono uppercase tracking-widest mb-8">Object Reconstruction via Computational AI</h2>
            <div className="flex flex-col gap-2 mb-8 border-l-2 border-[#FF4B4B] pl-6 py-3 bg-white/[0.02] backdrop-blur-xl rounded-r-2xl">
              <p className="text-white text-[10px] font-bold tracking-widest uppercase">Major Project</p>
              <p className="text-[#8A93A6] text-[10px] font-mono uppercase">BY ORCA DEVELOPMENT TEAM</p>
            </div>
            <p className="text-[#8A93A6] text-sm md:text-base leading-relaxed mb-10 italic max-w-md">
              A computational system capable of reconstructing complete 3D objects from broken or fragmented pieces using photogrammetry, geometry processing, and AI techniques.
            </p>
          </motion.div>
          
          <motion.div style={{ opacity: pOp, display: pDisplay }} className="absolute w-[90%] md:w-[600px] pointer-events-auto">
            <TiltCard glowColor="bg-[#FF4B4B]/10">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-6 text-[#FF4B4B]">Problem Statement</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                The preservation and restoration of physical objects—especially broken or fragmented ones—remain major challenges across archaeology, manufacturing, and heritage conservation.
              </p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4 border-l-2 border-[#FF4B4B]/50 pl-4 py-1">
                Traditional reconstruction methods are slow and highly dependent on expert manual effort. 
              </p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Existing 3D tools process complete objects but lack critical fragment alignment capabilities and AI-assisted completion workflows.
              </p>
            </TiltCard>
          </motion.div>
          
          <motion.div style={{ opacity: oOp, display: oDisplay }} className="absolute w-[90%] md:w-[600px] pointer-events-auto">
            <TiltCard glowColor="bg-[#0EA5E9]/10">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-6 text-[#0EA5E9]">System Objectives & Approach</h2>
              <ul className="space-y-4 font-mono text-[10px] md:text-xs text-slate-400 mb-6">
                <li className="flex items-center gap-3"><Check size={16} className="text-[#0EA5E9]"/> Accurate Fragment Capture via IMU</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-[#0EA5E9]"/> Robust 3D Pipeline (COLMAP/OpenMVS)</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-[#0EA5E9]"/> Fragment Alignment via ICP</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-[#0EA5E9]"/> Neural Surface Synthesis & AI Fill</li>
              </ul>
              <p className="text-slate-300 text-xs leading-relaxed border-t border-white/10 pt-4">
                Our approach combines Structure-from-Motion algorithms with Deep Learning to identify gaps and seamlessly repair geometry.
              </p>
            </TiltCard>
          </motion.div>

          <motion.div style={{ opacity: aOp, display: aDisplay }} className="absolute w-[90%] md:w-[600px] pointer-events-auto">
             <TiltCard glowColor="bg-[#1DF29F]/10">
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter mb-6 text-[#1DF29F]">Real-World Applications</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                <strong className="text-[#1DF29F] block mb-1">Archaeology:</strong> Digitally restoring artifacts without risking physical damage to the fragile originals.
              </p>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                <strong className="text-[#1DF29F] block mb-1">Manufacturing:</strong> Reverse engineering broken mechanical parts for rapid prototyping.
              </p>
              <p className="text-slate-300 text-sm leading-relaxed mb-8">
                <strong className="text-[#1DF29F] block mb-1">Heritage Conservation:</strong> Preserving historical objects digitally for future generations.
              </p>
              <button onClick={handleExecutePipeline} className="w-full py-4 bg-[#1DF29F] text-black font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-[0_0_20px_rgba(29,242,159,0.4)] interactive-target rounded-xl">
                 Init Pipeline Explainer
              </button>
             </TiltCard>
          </motion.div>

        </div>
      )}

      {viewMode === 'doc' && <Footer />}

    </div>
  );
};

// --- Dynamic Job / Model Card ---
const ModelCard = ({ job, onGenerateLore, isGenerating }) => {
  return (
    <div className={`${liquidGlass} overflow-hidden group flex flex-col interactive-target rounded-3xl border border-white/5 shadow-[0_16px_64px_rgba(0,0,0,0.4)]`}>
      <div className="h-48 relative p-2 bg-black/40 flex items-center justify-center">
        {job.status === 'completed' ? (
          <Box size={48} className="text-[#1DF29F] opacity-50 group-hover:scale-110 transition-transform duration-500" />
        ) : job.status === 'failed' ? (
          <X size={48} className="text-[#FF4B4B] opacity-50" />
        ) : (
          <Loader2 size={32} className="text-[#0EA5E9] animate-spin" />
        )}
        <div className={`absolute top-4 right-4 text-[9px] font-mono px-3 py-1 rounded bg-black/80 border uppercase font-bold tracking-widest
          ${job.status === 'completed' ? 'text-[#1DF29F] border-[#1DF29F]/30' : 
            job.status === 'failed' ? 'text-[#FF4B4B] border-[#FF4B4B]/30' : 
            'text-[#0EA5E9] border-[#0EA5E9]/30'}`}
        >
          {job.status}
        </div>
      </div>
      <div className="p-6 border-t border-white/5 flex flex-col justify-between flex-1 bg-[#0A0B10]/80">
        <div className="flex justify-between items-start mb-4">
          <div className="pr-4 overflow-hidden">
            <h3 className="text-white font-black uppercase tracking-wide group-hover:text-[#FF4B4B] transition-colors mb-1 text-sm md:text-base truncate">{job.name}</h3>
            <span className="text-[9px] font-mono text-[#8A93A6] uppercase tracking-widest">{job.method} | ID:{job.job_id.substring(0,6)}</span>
          </div>
          {job.status === 'completed' && <button className="text-[#8A93A6] hover:text-[#1DF29F] transition-colors bg-white/5 p-2 rounded-lg border border-white/10"><Download size={14} /></button>}
        </div>
        
        <div className="pt-4 border-t border-white/5 mt-auto">
          {job.lore ? (
            <p className="text-[10px] text-[#1DF29F] font-mono leading-relaxed bg-[#1DF29F]/5 p-3 border border-[#1DF29F]/20 rounded-xl">
              {job.lore}
            </p>
          ) : (
            <button 
              onClick={(e) => onGenerateLore(e, job.job_id, job.name)}
              disabled={isGenerating || job.status !== 'completed'}
              className="w-full py-3 bg-black/50 text-[#8A93A6] border border-white/10 hover:border-[#FF4B4B] hover:text-[#FF4B4B] text-[9px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-30 rounded-xl"
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin text-[#FF4B4B]" /> : <Wand2 size={12} />}
              {job.status === 'completed' ? 'Generate AI Profile' : 'Awaiting Mesh...'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DashboardView = () => {
  const { navigate, jobs, setJobs } = useContext(AppContext);
  const [generatingLoreMap, setGeneratingLoreMap] = useState({});

  const handleGenerateLore = async (e, jobId, jobName) => {
    e.stopPropagation();
    if (generatingLoreMap[jobId]) return;
    
    setGeneratingLoreMap(prev => ({ ...prev, [jobId]: true }));
    const prompt = `Write a short, professional, 2-sentence technical description for a 3D model named '${jobName}'. It was reconstructed using Photogrammetry from fragments. Make it sound like a high-tech asset in a digital museum or medical archive.`;
    
    try {
      const response = await generateGeminiText(prompt);
      setJobs(prev => {
        const updated = prev.map(j => j.job_id === jobId ? { ...j, lore: response } : j);
        localStorage.setItem('orca_jobs', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingLoreMap(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'completed').reverse();
  const recentJobs = jobs.slice().reverse().slice(0, 3); 

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 relative z-10">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Control Center</h1>
          <p className="text-[#1DF29F] font-mono text-[10px] uppercase tracking-widest mt-3 bg-[#1DF29F]/10 px-3 py-1 border border-[#1DF29F]/20 inline-block rounded-full shadow-[0_0_10px_#1DF29F]">SYS_STATUS: ONLINE | ORCA_V2</p>
        </div>
        <button onClick={() => navigate('upload')} className="px-6 py-3 bg-[#FF4B4B] text-white font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-colors hover:bg-white hover:text-black interactive-target rounded-xl shadow-[0_0_15px_rgba(255,75,75,0.3)]">
          <UploadCloud size={16} /> New Job
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[{ title: 'Total Models', val: completedJobs.length.toString(), icon: Box }, { title: 'Active Jobs', val: jobs.filter(j => j.status === 'processing' || j.status === 'pending' || j.status === 'uploading').length.toString(), icon: Cpu }, { title: 'Storage Used', val: '4.2 GB', icon: Database }].map((w, i) => (
          <div key={i} className={`${liquidGlass} hover:bg-[#0A0B10]/60 hover:border-[#FF4B4B]/50 transition-all duration-500 p-8 rounded-3xl cursor-default interactive-target`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest mb-3">{w.title}</p>
                <p className="text-5xl font-black text-white">{w.val}</p>
              </div>
              <div className="text-[#FF4B4B] bg-[#FF4B4B]/10 p-3 rounded-xl border border-[#FF4B4B]/20 shadow-[0_0_15px_rgba(255,75,75,0.1)]"><w.icon size={24} strokeWidth={1.5} /></div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Recent Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentJobs.map(job => (
            <ModelCard 
              key={job.job_id} 
              job={job} 
              onGenerateLore={handleGenerateLore} 
              isGenerating={generatingLoreMap[job.job_id]} 
            />
          ))}
          <div className={`border border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center h-full min-h-[350px] text-[#8A93A6] hover:text-[#FF4B4B] hover:border-[#FF4B4B]/50 hover:bg-[#FF4B4B]/5 cursor-pointer transition-all interactive-target bg-white/[0.01] backdrop-blur-xl`} onClick={() => navigate('upload')}>
            <UploadCloud size={32} className="mb-4" strokeWidth={1.5} />
            <p className="font-bold uppercase tracking-widest text-[10px]">Create New Entry</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArchiveView = () => {
  const { jobs, setJobs } = useContext(AppContext);
  const [generatingLoreMap, setGeneratingLoreMap] = useState({});

  const handleGenerateLore = async (e, jobId, jobName) => {
    e.stopPropagation();
    if (generatingLoreMap[jobId]) return;
    
    setGeneratingLoreMap(prev => ({ ...prev, [jobId]: true }));
    const prompt = `Write a short, professional, 2-sentence technical description for a 3D model named '${jobName}'. It was reconstructed using Photogrammetry from fragments. Make it sound like a high-tech asset in a digital museum or medical archive.`;
    
    try {
      const response = await generateGeminiText(prompt);
      setJobs(prev => {
        const updated = prev.map(j => j.job_id === jobId ? { ...j, lore: response } : j);
        localStorage.setItem('orca_jobs', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingLoreMap(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'completed').reverse();

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 relative z-10">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
            <FileArchive className="text-[#0EA5E9]" size={36} /> Model Archive
          </h1>
          <p className="text-[#8A93A6] font-mono text-[10px] uppercase tracking-widest mt-3">All successfully reconstructed assets</p>
        </div>
      </header>

      {completedJobs.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <Box className="mx-auto text-white/20 mb-4" size={40}/>
          <p className="text-[#8A93A6] font-mono text-xs uppercase tracking-widest">No models generated yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {completedJobs.map(job => (
             <ModelCard 
               key={`archive-${job.job_id}`} 
               job={job} 
               onGenerateLore={handleGenerateLore} 
               isGenerating={generatingLoreMap[job.job_id]} 
             />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Local File Universal Viewer Component ---
const LocalViewerView = () => {
  const { navigate } = useContext(AppContext);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileExt, setFileExt] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFileDrop = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      setFileExt(ext);
      setFileName(file.name);
      setFileUrl(URL.createObjectURL(file));
    }
  };

  const closeViewer = () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setFileExt(null);
    setFileName("");
  };

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500 relative z-10">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-white/10 pb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
            <MonitorPlay className="text-[#8A2BE2]" size={36} /> Local Asset Viewer
          </h1>
          <p className="text-[#8A93A6] font-mono text-[10px] uppercase tracking-widest mt-3">Render arbitrary 3D models locally in your browser.</p>
        </div>
      </header>

      {!fileUrl ? (
        <div className={`border border-dashed border-white/20 p-10 md:p-24 text-center hover:border-[#8A2BE2] hover:bg-[#8A2BE2]/5 transition-colors bg-white/[0.01] backdrop-blur-xl rounded-3xl`}>
           <div className="flex justify-center mb-6"><div className="p-5 bg-black/50 border border-white/10 rounded-2xl text-[#8A2BE2] shadow-inner"><Box size={40} strokeWidth={1.5} /></div></div>
           <h3 className="text-2xl md:text-3xl font-black uppercase text-white mb-3 tracking-tight">Drop 3D Asset</h3>
           <p className="text-[#8A93A6] mb-8 font-mono text-[10px] uppercase tracking-widest">SUPPORTED FORMATS: .PLY, .OBJ, .GLTF, .GLB</p>
           <label className="px-10 py-5 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-[#8A2BE2] hover:text-white transition-colors inline-block interactive-target shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(138,43,226,0.4)]">
              Browse Local Device<input type="file" accept=".ply,.obj,.gltf,.glb" className="hidden" onChange={handleFileDrop} />
           </label>
         </div>
      ) : (
         <div className="relative w-full h-[60vh] md:h-[70vh] border border-white/10 rounded-3xl overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.6)]">
             <UniversalViewer fileUrl={fileUrl} fileExt={fileExt} />
             <button onClick={closeViewer} className="absolute top-6 left-6 z-20 px-5 py-3 bg-black/80 backdrop-blur-md border border-white/10 text-white rounded-xl hover:bg-[#FF4B4B] hover:border-[#FF4B4B] transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 interactive-target">
                <X size={14}/> Close Asset
             </button>
             <div className="absolute bottom-6 left-6 z-20 px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 text-[#1DF29F] rounded-lg text-[10px] font-mono uppercase tracking-widest pointer-events-none">
                FILE: {fileName}
             </div>
         </div>
      )}
    </div>
  );
};

const UploadView = () => {
  const { navigate, setActiveJob, setJobs } = useContext(AppContext);
  const [method, setMethod] = useState('method_1');
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [targetObject, setTargetObject] = useState("");
  const [advisorResponse, setAdvisorResponse] = useState("");
  const [isAdvising, setIsAdvising] = useState(false);

  const handleStart = async () => {
    if (files.length < 5) {
        alert("Please upload at least 5 images as required by the backend.");
        return;
    }
    if (files.length > 500) {
        alert("Please limit your upload to a maximum of 500 images to prevent memory overflow.");
        return;
    }
    setIsUploading(true);
    try {
      const job = await API.createJob(method);
      await API.uploadImages(job.job_id, files);
      const startedJob = await API.startJob(job.job_id);
      
      const assignedName = targetObject.trim() ? targetObject.trim() : `Artifact-${job.job_id.substring(0, 4).toUpperCase()}`;

      const enhancedJob = {
        ...startedJob,
        name: assignedName,
        timestamp: new Date().toISOString()
      };

      setActiveJob(enhancedJob);
      setJobs(prev => {
        const newJobs = [...prev, enhancedJob];
        localStorage.setItem('orca_jobs', JSON.stringify(newJobs));
        return newJobs;
      });
      setIsUploading(false);
      navigate('processing');
    } catch(e) {
      alert("Error connecting to backend: " + e.message);
      setIsUploading(false);
    }
  };

  const getScanningAdvice = async () => {
    if (!targetObject.trim() || isAdvising) return;
    setIsAdvising(true);
    const prompt = `I want to 3D scan this broken object: "${targetObject}". Should I use Photogrammetry (M01) or Hybrid NeRF (M02)? Recommend the best engine, briefly explain why, and give 2 short tips for photographing this specific fragmented object for ICP alignment.`;
    const response = await generateGeminiText(prompt);
    setAdvisorResponse(response);
    if (response.toLowerCase().includes("hybrid nerf") || response.toLowerCase().includes("m02")) setMethod('method_2');
    else if (response.toLowerCase().includes("photogrammetry") || response.toLowerCase().includes("m01")) setMethod('method_1');
    setIsAdvising(false);
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-500 relative z-10">
       <header className="border-b border-white/10 pb-8">
         <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Upload Dataset</h1>
         <p className="text-[#8A93A6] font-mono text-[10px] uppercase tracking-widest mt-3">Input: Fragment Imagery &gt; Output: Unified 3D Artifact</p>
       </header>

       <div className="space-y-4">
         <h2 className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest flex items-center gap-2">
           <Sparkles size={14} className="text-[#FF4B4B]" /> Pre-Flight AI Advisor (Assigns Model Name)
         </h2>
         <div className={`${liquidGlass} p-8 rounded-3xl`}>
           <p className="text-xs md:text-sm text-white mb-6">Tell ORCA what fragmented object you are scanning. This text will be used to name your generated model in the archive.</p>
           <div className="flex flex-col md:flex-row gap-4">
             <input 
               type="text" value={targetObject} onChange={(e) => setTargetObject(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && getScanningAdvice()}
               placeholder="e.g., A broken ceramic vase, a skull fragment..." 
               className="flex-1 bg-black/50 border border-white/10 rounded-xl text-white px-5 py-4 text-xs md:text-sm focus:outline-none focus:border-[#FF4B4B] transition-colors placeholder:text-[#8A93A6]"
             />
             <button 
               onClick={getScanningAdvice} disabled={isAdvising || !targetObject.trim()}
               className="px-8 py-4 bg-[#FF4B4B]/10 border border-[#FF4B4B]/50 text-[#FF4B4B] rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#FF4B4B] hover:text-white transition-colors disabled:opacity-50 interactive-target flex items-center justify-center gap-2"
             >
               {isAdvising ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Analyze
             </button>
           </div>
           
           {advisorResponse && (
             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8 pt-8 border-t border-white/10 text-[10px] md:text-xs text-[#1DF29F] font-mono leading-relaxed">
               {advisorResponse.split('\n').map((line, i) => <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />)}
             </motion.div>
           )}
         </div>
       </div>

       <div className="space-y-6">
         <h2 className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest">Select Engine</h2>
         <div className="grid md:grid-cols-2 gap-6">
           <div onClick={() => setMethod('method_1')} className={`p-8 rounded-3xl border cursor-pointer transition-all interactive-target ${method === 'method_1' ? 'bg-[#FF4B4B]/10 border-[#FF4B4B] shadow-[0_0_20px_rgba(255,75,75,0.1)]' : `${liquidGlass} hover:bg-[#0A0B10]/60 hover:border-[#FF4B4B]/50 transition-all duration-500`}`}>
             <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight mb-3 ${method === 'method_1' ? 'text-[#FF4B4B]' : 'text-white'}`}>Photogrammetry (M01)</h3>
             <p className="text-[10px] md:text-xs text-[#8A93A6] font-mono leading-relaxed">COLMAP SfM + ICP Alignment + Poisson Meshing. Deterministic accuracy for heavily textured fragments.</p>
           </div>
           <div onClick={() => setMethod('method_2')} className={`p-8 rounded-3xl border cursor-pointer transition-all interactive-target ${method === 'method_2' ? 'bg-[#FF4B4B]/10 border-[#FF4B4B] shadow-[0_0_20px_rgba(255,75,75,0.1)]' : `${liquidGlass} hover:bg-[#0A0B10]/60 hover:border-[#FF4B4B]/50 transition-all duration-500`}`}>
             <h3 className={`text-lg md:text-xl font-black uppercase tracking-tight mb-3 ${method === 'method_2' ? 'text-[#FF4B4B]' : 'text-white'}`}>Hybrid NeRF (M02)</h3>
             <p className="text-[10px] md:text-xs text-[#8A93A6] font-mono leading-relaxed">Generative Completion AI. Synthesizes missing geometric data between broken fragments.</p>
           </div>
         </div>
       </div>

       <div className="space-y-6">
         <h2 className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest">Input Data</h2>
         <div className={`border border-dashed border-white/20 p-10 md:p-16 text-center hover:border-[#FF4B4B] hover:bg-[#FF4B4B]/5 transition-colors bg-white/[0.01] backdrop-blur-xl rounded-3xl`}>
           <div className="flex justify-center mb-6"><div className="p-4 bg-black/50 border border-white/10 rounded-2xl text-[#FF4B4B] shadow-inner"><ImageIcon size={32} strokeWidth={1.5} /></div></div>
           <h3 className="text-xl md:text-2xl font-black uppercase text-white mb-3 tracking-tight">Drop Image Directory</h3>
           <p className="text-[#8A93A6] mb-8 font-mono text-[10px] uppercase tracking-widest">JPG, PNG ACCEPTED. 5 TO 500 IMAGES PER FRAGMENT.</p>
           <label className="px-8 py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-[10px] cursor-pointer hover:bg-[#FF4B4B] hover:text-white transition-colors inline-block interactive-target shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(255,75,75,0.4)]">
              Browse Local Files<input type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files))} />
           </label>
           {files.length > 0 && (<motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="mt-8 font-mono text-[10px] uppercase tracking-widest text-[#1DF29F] bg-[#1DF29F]/10 py-2 px-5 inline-block rounded-lg border border-[#1DF29F]/20"><span className="font-bold">{files.length}</span> files staged in buffer</motion.div>)}
         </div>
       </div>

       <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-6 pt-8 border-t border-white/10">
         <button onClick={() => navigate('dashboard')} className="text-[#8A93A6] hover:text-white font-bold uppercase tracking-widest text-[10px] transition-colors interactive-target w-full md:w-auto text-center">Abort Sequence</button>
         <button onClick={handleStart} disabled={isUploading} className="px-10 py-4 bg-[#FF4B4B] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-white hover:text-black transition-all interactive-target shadow-lg shadow-[#FF4B4B]/20 w-full md:w-auto">
           {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} className="fill-current" />}{isUploading ? 'Executing...' : 'Dispatch Job'}
         </button>
       </div>
    </div>
  );
};

const ProcessingView = () => {
  const { activeJob, navigate, setJobs } = useContext(AppContext);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const stages = [
    { name: 'Workspace Prep', log: 'Images transferred to workspace.' },
    { name: 'Sparse Recon', log: 'COLMAP SfM Feature Extraction.' },
    { name: 'Dense Recon', log: 'MVS Depth Maps Generated.' },
    { name: 'Mesh Post-Process', log: 'Poisson Surface & Filtering.' },
    { name: 'Final Validation', log: 'Quality Check & Export.' }
  ];

  const backendLogs = [
    `[WorkerExecutor] Started job ${activeJob?.job_id} (method=${activeJob?.method})`,
    `[WorkerExecutor] Job ${activeJob?.job_id} marked as PROCESSING`,
    `[WorkerExecutor] Workspace prepared at workspace\\${activeJob?.job_id}`,
    `[WorkerExecutor] Images copied to workspace`,
    `[Pipeline] Starting photogrammetry pipeline in: workspace\\${activeJob?.job_id}`,
    `[Pipeline] Found input images`,
    `[Pipeline] Step 1/4 - Sparse reconstruction`,
    `[COLMAP] Using workspace images directory`,
    `[COLMAP] Feature extraction (GPU)`,
    `==============================================================================`,
    `Feature extraction`,
    `==============================================================================`,
    `Creating SIFT GPU feature extractor`,
    `Processed files successfully`,
    `[COLMAP] Feature matching (GPU)`,
    `[COLMAP] Sparse mapping`,
    `Global bundle adjustment`,
    `[COLMAP] Sparse model generated`,
    `[Pipeline] Step 2/4 - Dense reconstruction`,
    `[COLMAP] Image undistortion (debug mode)`,
    `[COLMAP] Patch match stereo (debug mode)`,
    `[COLMAP] Stereo fusion (debug mode)`,
    `[COLMAP] Poisson meshing`,
    `[Pipeline] Step 3/4 - Mesh post-processing`,
    `[MeshBuilder] Built mesh from fused point cloud`,
    `[MeshBuilder] Applied smoothing`,
    `[Pipeline] Step 4/4 - Mesh quality check`,
    `[QualityChecker] Mesh quality validated`,
    `[Pipeline] Method completed successfully`,
    `[WorkerExecutor] Job ${activeJob?.job_id} marked as COMPLETED`
  ];

  useEffect(() => {
    if (!activeJob) return;

    let simProgress = 0;
    let logIndex = 0;
    
    const poll = async () => {
      try {
        const res = await API.getJobStatus(activeJob.job_id);
        
        setJobs(prev => {
          const newJobs = prev.map(j => j.job_id === res.job_id ? { ...j, status: res.status } : j);
          localStorage.setItem('orca_jobs', JSON.stringify(newJobs));
          return newJobs;
        });

        if (res.status === 'completed') {
          setProgress(100);
          setStage(5);
          setLogs(backendLogs);
        } else if (res.status === 'failed') {
           alert("Job failed on backend.");
        } else {
           simProgress += (Math.random() * 8);
           if (simProgress > 95) simProgress = 95;
           setProgress(Math.floor(simProgress));
           setStage(Math.min(Math.floor((simProgress / 100) * stages.length), 4));

           const targetLogIndex = Math.floor((simProgress / 100) * backendLogs.length);
           if (targetLogIndex > logIndex) {
             setLogs(backendLogs.slice(0, targetLogIndex));
             logIndex = targetLogIndex;
           }
        }
      } catch (e) {
        console.error(e);
      }
    };

    const interval = setInterval(() => {
      if (progress < 100) poll();
    }, 2000);

    const rapidLogInterval = setInterval(() => {
      if (logIndex < 6) {
         setLogs(backendLogs.slice(0, logIndex + 1));
         logIndex++;
      } else {
         clearInterval(rapidLogInterval);
      }
    }, 400);

    return () => {
       clearInterval(interval);
       clearInterval(rapidLogInterval);
    };
  }, [activeJob]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto md:h-[calc(100vh-100px)] flex flex-col animate-in fade-in duration-500 relative z-10">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 border-b border-white/10 pb-8 mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Execution</h1>
          <p className="text-[#8A93A6] font-mono text-[10px] uppercase tracking-widest mt-3 flex items-center gap-3 bg-black/30 px-4 py-2 border border-white/10 rounded-full inline-flex">
            <span className="text-[#1DF29F] font-bold">{activeJob?.name}</span><span className="w-1 h-1 rounded-full bg-[#8A93A6]"></span><span>ID: {activeJob?.job_id?.substring(0,8) || 'JOB-8F92'}</span>
          </p>
        </div>
        {progress === 100 && (<motion.button initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} onClick={() => navigate('dashboard')} className="px-8 py-3 bg-[#1DF29F] text-black rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-colors interactive-target shadow-[0_0_20px_rgba(29,242,159,0.3)]">Return to Dashboard</motion.button>)}
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        <div className="space-y-8 flex flex-col h-full">
          
          <div className={`${liquidGlass} rounded-3xl p-8 shadow-[0_16px_64px_rgba(0,0,0,0.8)]`}>
            <h2 className="text-[10px] font-bold text-[#8A93A6] font-mono uppercase tracking-widest mb-8">Pipeline State</h2>
            <div className="space-y-6">
              {stages.map((s, i) => (
                <div key={i} className="flex gap-4 md:gap-5 relative">
                  {i !== stages.length - 1 && <div className={`absolute left-[11px] top-8 bottom-[-24px] w-px ${stage > i ? 'bg-[#FF4B4B]' : 'bg-white/10'}`} />}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0 transition-colors duration-300 ${stage > i ? 'bg-[#FF4B4B] text-black shadow-[0_0_10px_#FF4B4B]' : stage === i ? 'bg-white text-black' : 'bg-black border border-white/10 text-white/20'}`}>
                    {stage > i ? <CheckCircle2 size={14} strokeWidth={3} /> : (stage === i ? <Loader2 size={12} className="animate-spin text-[#1DF29F]" /> : <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />)}
                  </div>
                  <div>
                    <p className={`text-xs md:text-sm font-bold uppercase tracking-wide transition-colors ${stage >= i ? 'text-white' : 'text-[#8A93A6]'}`}>{s.name}</p>
                    <p className="text-[9px] md:text-[10px] font-mono uppercase tracking-widest text-[#8A93A6] mt-1">{stage >= i ? s.log : 'AWAITING...'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-black/50 backdrop-blur-2xl border border-white/10 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-[0_16px_64px_rgba(0,0,0,0.8)] min-h-[300px]">
            <div className="bg-white/5 px-6 py-4 text-[10px] text-[#8A93A6] uppercase tracking-widest font-mono border-b border-white/5 flex justify-between items-center"><span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF4B4B] animate-pulse"/> WORKER_EXECUTOR.PY</span><span className="text-[#FF4B4B] font-bold">{progress}%</span></div>
            <div className="p-6 font-mono text-[10px] text-[#8A93A6] space-y-2 overflow-y-auto flex-1 tracking-wider leading-relaxed">
              {logs.map((log, i) => (
                <p key={i} className={
                  log.includes("COMPLETED") || log.includes("SUCCESSFUL") || log.includes("successfully") ? "text-[#1DF29F] font-bold" : 
                  log.includes("Feature extraction") || log.includes("Pipeline") ? "text-white font-bold" : 
                  log.includes("ERROR") || log.includes("FAILED") ? "text-[#FF4B4B]" : 
                  "opacity-80"
                }>
                  {log}
                </p>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

        <div className="lg:col-span-2 relative p-2 bg-black/30 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_16px_64px_rgba(0,0,0,0.8)] min-h-[400px] md:min-h-auto flex items-center justify-center">
          <PlyViewer jobId={activeJob?.job_id} isCompleted={progress === 100} />
        </div>
      </div>
    </div>
  );
};

// --- APP LAYOUT ---
const AppLayout = ({ children }) => {
  const { currentPath, navigate } = useContext(AppContext);
  const isL = currentPath === 'landing';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', icon: Layers, label: 'Dashboard' },
    { id: 'archive', icon: FileArchive, label: 'Model Archive' },
    { id: 'viewer', icon: MonitorPlay, label: 'Model Viewer' },
    { id: 'upload', icon: UploadCloud, label: 'New Job' }
  ];

  return (
    <div className={`min-h-screen bg-[#05050A] text-white flex font-sans selection:bg-[#FF4B4B]/30 relative ${!isL ? 'overflow-hidden' : ''}`}>
      {!isL && <CustomCursor />}
      
      {/* Mobile Topbar for internal views */}
      {!isL && (
        <div className="md:hidden fixed top-0 w-full z-50 bg-[#05050A]/80 backdrop-blur-2xl border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 font-black tracking-tighter text-white" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 rounded-lg bg-[#FF4B4B]/20 border border-[#FF4B4B]/50 flex items-center justify-center text-[#FF4B4B]">
              <Box size={16} />
            </div>
            ORCA
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      )}

      <AnimatePresence>
        {!isL && isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-4 right-4 ${liquidGlass} rounded-2xl p-6 flex flex-col gap-4 z-40 md:hidden`}
          >
            {navItems.map(item => (
              <button key={item.id} onClick={() => { navigate(item.id); setIsMobileMenuOpen(false); }} className={`flex items-center gap-4 py-3 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest ${currentPath === item.id ? 'bg-[#FF4B4B]/10 text-[#FF4B4B]' : 'text-[#8A93A6]'}`}>
                <item.icon size={16} /> {item.label}
              </button>
            ))}
            <button className="flex items-center gap-4 py-3 px-4 text-[#8A93A6] mt-4 border-t border-white/10"><LogOut size={16} /> <span className="text-[10px] font-bold uppercase tracking-widest">Disconnect</span></button>
          </motion.div>
        )}
      </AnimatePresence>

      {!isL && (
        <aside className="hidden md:flex w-72 border-r border-white/5 bg-[#05050A]/60 backdrop-blur-3xl flex-col z-20 relative">
          <div className="p-10 pb-12 flex items-center gap-3 text-2xl font-black tracking-tighter text-white cursor-pointer interactive-target" onClick={() => navigate('landing')}>
            <div className="w-8 h-8 rounded-lg bg-[#FF4B4B]/20 border border-[#FF4B4B]/50 flex items-center justify-center text-[#FF4B4B]">
              <Box size={16} />
            </div>
            ORCA
          </div>
          <nav className="flex-1 px-6 space-y-3 mt-4">
            {navItems.map(item => (
              <button key={item.id} onClick={() => navigate(item.id)} className={`w-full flex items-center gap-4 py-4 px-6 rounded-2xl transition-all font-bold text-[10px] uppercase tracking-widest relative group interactive-target ${currentPath === item.id ? 'bg-white/10 text-[#FF4B4B] border border-white/10 shadow-inner' : 'text-[#8A93A6] border border-transparent hover:bg-white/5 hover:text-white'}`}>
                <item.icon size={18} className={`${currentPath === item.id ? 'text-[#FF4B4B]' : ''}`} strokeWidth={1.5} /> {item.label}
              </button>
            ))}
          </nav>
          <div className="p-8 border-t border-white/5">
            <button className="flex items-center gap-3 py-4 px-6 text-[#8A93A6] hover:text-white w-full font-bold text-[10px] uppercase tracking-widest transition-colors interactive-target"><LogOut size={16} /> Disconnect</button>
          </div>
        </aside>
      )}
      <main className={`flex-1 relative z-10 scroll-smooth bg-[#05050A] ${!isL ? 'pt-20 md:pt-0 overflow-y-auto' : 'bg-transparent'}`}>
         {children}
      </main>
    </div>
  );
};

export default function App() {
  const [currentPath, setCurrentPath] = useState('landing');
  const [activeJob, setActiveJob] = useState(null);
  
  const [jobs, setJobs] = useState(() => {
    try {
      const localData = localStorage.getItem('orca_jobs');
      return localData ? JSON.parse(localData) : [];
    } catch(e) {
      return [];
    }
  });

  const navigate = (path) => {
    window.scrollTo(0, 0);
    setCurrentPath(path);
  };

  const renderView = () => {
    switch (currentPath) {
      case 'landing': return <LandingRoot />;
      case 'dashboard': return <DashboardView />;
      case 'archive': return <ArchiveView />;
      case 'viewer': return <LocalViewerView />;
      case 'upload': return <UploadView />;
      case 'processing': return <ProcessingView />;
      default: return <DashboardView />;
    }
  };

  return (
    <AppContext.Provider value={{ currentPath, navigate, activeJob, setActiveJob, jobs, setJobs }}>
      <AppLayout>
        <AnimatePresence mode="wait">
          <motion.div key={currentPath} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="h-full relative w-full">
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </AppLayout>
    </AppContext.Provider>
  );
}