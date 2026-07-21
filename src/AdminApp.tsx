import { useState, useEffect, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { supabase } from "@/lib/supabase";
import type { Product, ProductFormData } from "@/types/product";
import { CATEGORIES } from "@/types/product";
import type { Review, ReviewFormData } from "@/types/review";
import type { BirthdayClaim } from "@/types/birthdayClaim";
import type { Order } from "@/types/order";

// Define Banner type
type Banner = {
    id: number;
    image_url: string;
    display_order: number;
    created_at: string;
};

type BannerFormData = {
    image_url: string;
    display_order: number;
};

const ADMIN_PASSWORD = "paprish@123";
const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f2dbb8' width='400' height='300'/%3E%3Ctext fill='%23c4853d' font-family='serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";

const emptyProduct: ProductFormData = { name: "", category: "instant-mixes", price: "", weight: "", description: "", image_url: null, featured: false, display_order: 0 };
const emptyReview: ReviewFormData = { name: "", location: "", quote: "", rating: 5, source: "WhatsApp", is_approved: true };
const emptyBanner: BannerFormData = { image_url: "", display_order: 0 };

// ─── Utility: Canvas Cropper ──────────────────────────────────────────────────
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous");
        image.src = url;
    });

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob | null> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: () => void }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem("paprish_admin", "true");
            onLogin();
        } else {
            setError(true); setShake(true); setTimeout(() => setShake(false), 500);
        }
    }

    return (
        <div className="min-h-screen bg-charcoal flex items-center justify-center px-4 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 20px)" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-paprish-500/10 rounded-full blur-[120px]" />
            <div className={`relative z-10 w-full max-w-sm transition-all duration-500 ${shake ? "translate-x-2" : ""}`}>
                <div className="text-center mb-10">
                    <img src="/images/logo.png" alt="Paprish Foods Logo" className="h-24 sm:h-32 w-auto mx-auto mb-5 object-contain drop-shadow-2xl" />
                    <p className="text-paprish-400 tracking-[0.2em] uppercase text-xs font-medium mt-1">Admin Portal</p>
                </div>
                <form onSubmit={handleSubmit} className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Access Key</label>
                    <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }} placeholder="••••••••" autoFocus className={`w-full px-5 py-4 rounded-xl bg-white/[0.04] border ${error ? "border-red-500/60 text-red-200" : "border-white/[0.08] text-white"} placeholder:text-white/20 outline-none focus:border-paprish-400/60 focus:bg-white/[0.08] transition-all duration-300 text-sm mb-6`} />
                    <button type="submit" className="w-full bg-paprish-500 hover:bg-paprish-400 text-white font-semibold py-4 rounded-xl transition-all duration-300 text-sm shadow-lg shadow-paprish-500/20">Authenticate</button>
                </form>
            </div>
        </div>
    );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminApp() {
    const [authed, setAuthed] = useState(() => sessionStorage.getItem("paprish_admin") === "true");
    const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "reviews" | "banners" | "birthday" | "orders">("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [products, setProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [banners, setBanners] = useState<Banner[]>([]);
    const [birthdayClaims, setBirthdayClaims] = useState<BirthdayClaim[]>([]);
const [orders, setOrders] = useState<Order[]>([]);
    const [signedProofUrls, setSignedProofUrls] = useState<Record<string, string>>({});
    const [profileOpen, setProfileOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const [productModal, setProductModal] = useState<Product | "new" | null>(null);
    const [productCategoryFilter, setProductCategoryFilter] = useState("all");
    const [reviewModal, setReviewModal] = useState<Review | "new" | null>(null);
    const [bannerModal, setBannerModal] = useState<Banner | "new" | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [pForm, setPForm] = useState<ProductFormData>(emptyProduct);
    const [rForm, setRForm] = useState<ReviewFormData>(emptyReview);
    const [bForm, setBForm] = useState<BannerFormData>(emptyBanner);
    const [saving, setSaving] = useState(false);

    // Crop state for products
    const [cropFile, setCropFile] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Crop state for banners
    const [bannerCropFile, setBannerCropFile] = useState<string | null>(null);
    const [bannerCrop, setBannerCrop] = useState({ x: 0, y: 0 });
    const [bannerZoom, setBannerZoom] = useState(1);
    const [bannerCroppedAreaPixels, setBannerCroppedAreaPixels] = useState(null);
    const bannerFileInputRef = useRef<HTMLInputElement>(null);

    // ─── Data loading ──────────────────────────────────────────────────────
    async function loadData() {
        setLoading(true);
        const [pRes, rRes, bRes, cRes, oRes] = await Promise.all([
            supabase.from("products").select("*").order("display_order", { ascending: true }),
            supabase.from("reviews").select("*").order("created_at", { ascending: false }),
            supabase.from("banners").select("*").order("display_order", { ascending: true }),
            supabase.from("birthday_claims").select("*").order("created_at", { ascending: false }),
            supabase.from("orders").select("*").order("created_at", { ascending: false })
        ]);
        if (pRes.data) setProducts(pRes.data as Product[]);
        if (rRes.data) setReviews(rRes.data as Review[]);
        if (bRes.data) setBanners(bRes.data as Banner[]);
        if (cRes.data) setBirthdayClaims(cRes.data as BirthdayClaim[]);
        if (oRes.data) setOrders(oRes.data as Order[]);
        setLoading(false);
    }

    useEffect(() => { if (authed) loadData(); }, [authed]);

    // Bucket is private — generate a temporary signed URL for each claim's
    // proof so it can actually be viewed/previewed in the admin panel.
    useEffect(() => {
        async function fetchSignedUrls() {
            const entries = await Promise.all(
                birthdayClaims
                    .filter(c => c.proof_url)
                    .map(async (c) => {
                        const path = (c.proof_url as string).split("/").pop()?.split("?")[0] || (c.proof_url as string);
                        const { data, error } = await supabase.storage.from("birthday-proofs").createSignedUrl(path, 3600);
                        return [c.id, error ? null : data?.signedUrl] as const;
                    })
            );
            const map: Record<string, string> = {};
            entries.forEach(([id, url]) => { if (url) map[id] = url; });
            setSignedProofUrls(map);
        }
        if (birthdayClaims.length > 0) fetchSignedUrls();
    }, [birthdayClaims]);
    function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

    // ─── Crop handlers ─────────────────────────────────────────────────────
    // Product crop
    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
    async function handleCropAndUpload() {
        if (!cropFile || !croppedAreaPixels) return;
        setSaving(true);
        try {
            const croppedBlob = await getCroppedImg(cropFile, croppedAreaPixels);
            if (croppedBlob) {
                const file = new File([croppedBlob], `product-${Date.now()}.jpg`, { type: "image/jpeg" });
                const { error } = await supabase.storage.from("product-images").upload(file.name, file, { upsert: true });
                if (error) {
                    console.error("Product upload error:", error);
                    showToast("Upload failed: " + error.message);
                    setSaving(false);
                    return;
                }
                const { data } = supabase.storage.from("product-images").getPublicUrl(file.name);
                setPForm({ ...pForm, image_url: data.publicUrl });
                showToast("Image uploaded!");
            }
        } catch (e) {
            console.error("Product crop failed", e);
            showToast("An error occurred during crop/upload.");
        }
        setCropFile(null);
        setSaving(false);
    }

    // Banner crop
    const onBannerCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => { setBannerCroppedAreaPixels(croppedAreaPixels); }, []);
    async function handleBannerCropAndUpload() {
        if (!bannerCropFile || !bannerCroppedAreaPixels) return;
        setSaving(true);
        try {
            const croppedBlob = await getCroppedImg(bannerCropFile, bannerCroppedAreaPixels);
            if (croppedBlob) {
                const file = new File([croppedBlob], `banner-${Date.now()}.jpg`, { type: "image/jpeg" });
                // ✅ ENSURE THIS BUCKET EXISTS IN SUPABASE
                const { error } = await supabase.storage.from("banner-images").upload(file.name, file, { upsert: true });
                if (error) {
                    console.error("Banner upload error:", error);
                    showToast("Upload failed: " + error.message);
                    setSaving(false);
                    return;
                }
                const { data } = supabase.storage.from("banner-images").getPublicUrl(file.name);
                setBForm({ ...bForm, image_url: data.publicUrl });
                showToast("Banner image uploaded!");
            }
        } catch (e) {
            console.error("Banner crop failed", e);
            showToast("An error occurred during crop/upload.");
        }
        setBannerCropFile(null);
        setSaving(false);
    }

    // ─── Product CRUD ─────────────────────────────────────────────────────
    async function saveProduct() {
        setSaving(true);
        if (productModal === "new") await supabase.from("products").insert(pForm);
        else await supabase.from("products").update(pForm).eq("id", (productModal as Product).id);
        setSaving(false); setProductModal(null); showToast("Product saved successfully!"); loadData();
    }
    async function deleteProduct(id: string) {
        if (!confirm("Are you sure you want to delete this product?")) return;
        await supabase.from("products").delete().eq("id", id);
        showToast("Product deleted!"); loadData();
    }

    // ─── Review CRUD ──────────────────────────────────────────────────────
    async function saveReview() {
        setSaving(true);
        if (reviewModal === "new") await supabase.from("reviews").insert(rForm);
        else await supabase.from("reviews").update(rForm).eq("id", (reviewModal as Review).id);
        setSaving(false); setReviewModal(null); showToast("Review saved successfully!"); loadData();
    }
    async function deleteReview(id: string) {
        if (!confirm("Are you sure you want to delete this review?")) return;
        await supabase.from("reviews").delete().eq("id", id);
        showToast("Review deleted!"); loadData();
    }
    async function toggleReviewApproval(id: string, current: boolean) {
        await supabase.from("reviews").update({ is_approved: !current }).eq("id", id);
        loadData();
    }

    // ─── Banner CRUD ──────────────────────────────────────────────────────
    async function saveBanner() {
        setSaving(true);
        if (bannerModal === "new") {
            await supabase.from("banners").insert(bForm);
        } else {
            await supabase.from("banners").update(bForm).eq("id", (bannerModal as Banner).id);
        }
        setSaving(false); setBannerModal(null); showToast("Banner saved successfully!"); loadData();
    }
    async function deleteBanner(id: number) {
        if (!confirm("Are you sure you want to delete this banner?")) return;
        await supabase.from("banners").delete().eq("id", id);
        showToast("Banner deleted!"); loadData();
    }

    // ─── Birthday Claim actions ────────────────────────────────────────────
    async function updateClaimStatus(id: string, status: "approved" | "rejected") {
        await supabase.from("birthday_claims").update({ status }).eq("id", id);
        showToast(`Claim marked as ${status}!`); loadData();
    }
    async function deleteClaim(claim: BirthdayClaim) {
        if (!confirm("Delete this entire birthday claim (order details + proof)? This can't be undone.")) return;
        try {
            if (claim.proof_url) {
                const fileName = claim.proof_url.split("/").pop()?.split("?")[0];
                if (fileName) await supabase.storage.from("birthday-proofs").remove([fileName]);
            }
            const { error: deleteError } = await supabase.from("birthday_claims").delete().eq("id", claim.id);
            if (deleteError) { showToast("Delete failed: " + deleteError.message); return; }
            showToast("Claim deleted!"); loadData();
        } catch (e) {
            showToast("An error occurred while deleting the claim.");
        }
    }
    // ─── Order actions ────────────────────────────────────────────────────
    async function updateOrderStatus(id: string, status: "confirmed" | "shipped" | "delivered" | "cancelled") {
        await supabase.from("orders").update({ status }).eq("id", id);
        showToast(`Order marked as ${status}!`); loadData();
    }
    async function deleteOrder(id: string) {
        if (!confirm("Delete this order? This can't be undone.")) return;
        await supabase.from("orders").delete().eq("id", id);
        showToast("Order deleted!"); loadData();
    }

    async function deleteClaimProof(claim: BirthdayClaim) {
        if (!claim.proof_url) return;
        if (!confirm("Delete this proof image? This can't be undone.")) return;
        try {
            const fileName = claim.proof_url.split("/").pop()?.split("?")[0];
            if (fileName) {
                const { error: removeError } = await supabase.storage.from("birthday-proofs").remove([fileName]);
                if (removeError) { showToast("Delete failed: " + removeError.message); return; }
            }
            await supabase.from("birthday_claims").update({ proof_url: null }).eq("id", claim.id);
            showToast("Proof deleted!"); loadData();
        } catch (e) {
            showToast("An error occurred while deleting the proof.");
        }
    }

    if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
    const pendingReviews = reviews.filter(r => !r.is_approved).length;
    const pendingClaims = birthdayClaims.filter(c => c.status === "pending").length;
    const pendingOrders = orders.filter(o => o.status === "pending").length;

    const filteredProducts =
        productCategoryFilter === "all"
            ? products
            : products.filter(
                (p) => p.category === productCategoryFilter
            );

    return (
        <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-[100] bg-charcoal text-white text-sm font-medium px-6 py-4 rounded-xl shadow-2xl animate-fade-up flex items-center gap-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f2dbb8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    {toast}
                </div>
            )}

            {/* ─── Mobile Sidebar Overlay ─── */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ─── Sidebar ─── */}
            <aside className={`fixed inset-y-0 left-0 z-50 transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 transition-transform duration-300 w-64 bg-charcoal text-white flex flex-col shrink-0`}>
                <div className="p-8 pb-10 border-b border-white/[0.05] relative">
                    <img src="/images/logo.png" alt="Paprish Foods Logo" className="h-16 w-auto mb-4 object-contain drop-shadow-lg" />
                    <h2 className="font-serif font-bold text-xl tracking-tight">Paprish Foods</h2>
                    <p className="text-[0.65rem] text-paprish-400 uppercase tracking-widest font-semibold mt-1">Admin Center</p>
                    <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white lg:hidden">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: "dashboard", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
                        { id: "products", label: "Product Catalogue", icon: "M20 16.2A2 2 0 0 1 18 18H6a2 2 0 0 1-2-2V7.8A2 2 0 0 1 6 6h12a2 2 0 0 1 2 1.8v8.4z" },
                        { id: "reviews", label: "Customer Reviews", icon: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" },
                        { id: "banners", label: "Banners", icon: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1 16H6V5h12v14zM8 7h3v3H8V7zm0 7h8v2H8v-2z" },
                        { id: "orders", label: "Orders", icon: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" },
                        { id: "birthday", label: "Birthday Claims", icon: "M12 2v4M9 6a3 3 0 1 1 6 0v2H9V6zM4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10zM4 14h16" }
                    ].map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id as any); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${activeTab === item.id ? "bg-paprish-500 text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white"}`}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
                            {item.label}
                            {item.id === "reviews" && pendingReviews > 0 && <span className="ml-auto bg-red-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full">{pendingReviews}</span>}
                            {item.id === "orders" && pendingOrders > 0 && <span className="ml-auto bg-red-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full">{pendingOrders}</span>}
                            {item.id === "birthday" && pendingClaims > 0 && <span className="ml-auto bg-red-500 text-white text-[0.65rem] px-2 py-0.5 rounded-full">{pendingClaims}</span>}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/[0.05]">
                    <button onClick={() => { sessionStorage.removeItem("paprish_admin"); setAuthed(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                        Secure Logout
                    </button>
                </div>
            </aside>

            {/* ─── Main Content Area ─── */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white h-16 sm:h-20 px-4 sm:px-10 flex items-center justify-between border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden text-charcoal hover:bg-gray-100 p-2 rounded-lg" onClick={() => setSidebarOpen(true)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
                        </button>
                        <h1 className="font-serif text-xl sm:text-2xl font-bold text-charcoal capitalize">{activeTab}</h1>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setProfileOpen(!profileOpen)}
                            title="Profile"
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-paprish-400 to-paprish-600 text-white flex items-center justify-center hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        >
                            <span className="text-[0.6rem] sm:text-xs font-bold">PA</span>
                        </button>
                        {profileOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 py-2 animate-fade-in">
                                    <div className="px-4 py-3 border-b border-gray-50">
                                        <p className="text-sm font-bold text-charcoal">Admin</p>
                                        <p className="text-[0.65rem] text-gray-400">paprish@admin</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setProfileOpen(false);
                                            if (confirm("Are you sure you want to sign out?")) {
                                                sessionStorage.removeItem("paprish_admin");
                                                setAuthed(false);
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 font-medium hover:bg-red-50 transition-colors"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                                        Sign Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-10">
                    {loading ? (
                        <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-paprish-500 border-t-transparent rounded-full animate-spin" /></div>
                    ) : activeTab === "dashboard" ? (
                        <div className="space-y-6 sm:space-y-8 animate-fade-in">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[100px] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-300" />
                                    <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 16.2A2 2 0 0 1 18 18H6a2 2 0 0 1-2-2V7.8A2 2 0 0 1 6 6h12a2 2 0 0 1 2 1.8v8.4z" /></svg></div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Products</div>
                                    <div className="text-3xl font-bold text-charcoal">{products.length}</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-[100px] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-300" />
                                    <div className="w-11 h-11 bg-gradient-to-br from-green-400 to-green-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg></div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Approved Reviews</div>
                                    <div className="text-3xl font-bold text-charcoal">{reviews.filter(r => r.is_approved).length}</div>
                                    {reviews.length > 0 && (
                                        <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500" style={{ width: `${(reviews.filter(r => r.is_approved).length / reviews.length) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-[100px] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-300" />
                                    <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-orange-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" /></svg></div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Action Required</div>
                                    <div className="text-3xl font-bold text-charcoal">{pendingReviews}</div>
                                    <div className="text-xs font-medium text-gray-400 mt-1">{pendingReviews} pending review{pendingReviews !== 1 ? "s" : ""}</div>
                                    {pendingReviews > 0 && <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-orange-600" />}
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-[100px] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-300" />
                                    <div className="w-11 h-11 bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" /></svg></div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Orders</div>
                                    <div className="text-3xl font-bold text-charcoal">{orders.length + birthdayClaims.length}</div>
                                    <div className="text-xs font-medium text-gray-400 mt-1">
                                        {orders.length} regular · {birthdayClaims.length} birthday
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-[100px] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-300" />
                                    <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-pink-500 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-pink-500/20"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M9 6a3 3 0 1 1 6 0v2H9V6zM4 10h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10zM4 14h16" /></svg></div>
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Birthday Offers</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-charcoal">{birthdayClaims.filter(c => c.status === "pending").length}</span>
                                        <span className="text-sm font-medium text-gray-400">pending</span>
                                        <span className="text-lg font-bold text-green-600">/</span>
                                        <span className="text-3xl font-bold text-green-600">{birthdayClaims.filter(c => c.status === "approved").length}</span>
                                        <span className="text-sm font-medium text-green-500">done</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === "products" ? (
                        <div className="animate-fade-in">
                            <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                                <select
                                    value={productCategoryFilter}
                                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm"
                                >
                                    <option value="all">All Categories</option>
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    onClick={() => {
                                        setPForm(emptyProduct);
                                        setProductModal("new");
                                    }}
                                    className="bg-charcoal text-white px-6 py-3 rounded-xl text-sm font-medium"
                                >
                                    Add New Product
                                </button>
                            </div>
                            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                                        <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                                            <img src={p.image_url || PLACEHOLDER} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setPForm(p); setProductModal(p); }} className="w-8 h-8 bg-white text-charcoal rounded-lg shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                                                <button onClick={() => deleteProduct(p.id)} className="w-8 h-8 bg-white text-red-500 rounded-lg shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                                            </div>
                                        </div>
                                        <div className="p-4 sm:p-5">
                                            <div className="text-[0.65rem] text-paprish-600 font-bold uppercase tracking-wider mb-1">{p.weight}</div>
                                            <h3 className="font-serif font-bold text-charcoal mb-1 truncate">{p.name}</h3>
                                            <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-100">
                                                <span className="text-xs text-gray-500">Order: {p.display_order}</span>
                                                <span className="font-bold text-charcoal">₹{p.price}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === "reviews" ? (
                        <div className="animate-fade-in max-w-4xl mx-auto">
                            <div className="flex justify-end mb-6">
                                <button onClick={() => { setRForm(emptyReview); setReviewModal("new"); }} className="w-full sm:w-auto bg-charcoal text-white px-6 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center justify-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg> Add Manual Review
                                </button>
                            </div>
                            <div className="space-y-4">
                                {reviews.map(r => (
                                    <div key={r.id} className={`bg-white p-4 sm:p-6 rounded-2xl shadow-sm border-l-4 ${r.is_approved ? 'border-transparent' : 'border-orange-500'}`}>
                                        <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-3">
                                            <div>
                                                <h3 className="font-bold text-charcoal flex flex-wrap items-center gap-2">
                                                    {r.name} <span className="font-normal text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{r.source}</span>
                                                    {!r.is_approved && <span className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">Pending</span>}
                                                </h3>
                                                <div className="text-xs text-gray-500 mt-1">{r.location} &middot; {r.rating} Stars</div>
                                            </div>
                                            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 bg-gray-50 px-3 py-2 sm:py-1.5 rounded-lg border border-gray-100">
                                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-charcoal">
                                                    <input type="checkbox" checked={r.is_approved} onChange={() => toggleReviewApproval(r.id, r.is_approved)} className="w-4 h-4 accent-paprish-500" />
                                                    Visible
                                                </label>
                                                <div className="w-px h-4 bg-gray-300 mx-1 hidden sm:block" />
                                                <div className="flex gap-3">
                                                    <button onClick={() => { setRForm(r); setReviewModal(r); }} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
                                                    <button onClick={() => deleteReview(r.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-3 sm:p-4 rounded-xl border border-gray-100 italic">"{r.quote}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeTab === "banners" ? (
                        // ─── Banners Tab ──────────────────────────────────────────────────────
                        <div className="animate-fade-in">
                            <div className="flex justify-end mb-6">
                                <button
                                    onClick={() => {
                                        setBForm(emptyBanner);
                                        setBannerModal("new");
                                    }}
                                    className="bg-charcoal text-white px-6 py-3 rounded-xl text-sm font-medium"
                                >
                                    Add New Banner
                                </button>
                            </div>
                            {banners.length === 0 ? (
                                <div className="text-center text-gray-400 py-20">No banners yet. Click "Add New Banner" to get started.</div>
                            ) : (
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {banners.map(b => (
                                        <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
                                            <div className="aspect-[16/9] bg-gray-50 relative overflow-hidden">
                                                <img src={b.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setBForm({ image_url: b.image_url, display_order: b.display_order }); setBannerModal(b); }} className="w-8 h-8 bg-white text-charcoal rounded-lg shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                                                    <button onClick={() => deleteBanner(b.id)} className="w-8 h-8 bg-white text-red-500 rounded-lg shadow-lg flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                                                </div>
                                            </div>
                                            <div className="p-4 sm:p-5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Order: {b.display_order}</span>
                                                    <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : activeTab === "orders" ? (
                        <div className="space-y-6 animate-fade-in">
                            {(() => {
                                const allOrders = [
                                    ...orders.map(o => ({ ...o, _type: "order" as const })),
                                    ...birthdayClaims.map(c => ({ ...c, _type: "birthday" as const, shipping_region: "", subtotal: c.total, shipping: 0 }))
                                ].sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());
                                return allOrders.length === 0 ? (
                                    <div className="text-center py-24 text-gray-400">
                                        <p className="font-serif text-2xl mb-2">No orders yet</p>
                                        <p className="text-sm">Orders placed from the storefront will show up here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {allOrders.map(o => (
                                            <div key={o.id} className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-6 ${o._type === "birthday" ? "border-pink-200" : "border-gray-100"}`}>
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <h3 className="font-bold text-charcoal">{o.name}</h3>
                                                    {o._type === "birthday" && <span className="text-[0.65rem] font-bold px-2.5 py-1 rounded-full bg-pink-100 text-pink-700">🎂 Birthday</span>}
                                                    <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${o.status === "delivered" || o.status === "approved" ? "bg-green-100 text-green-700" : o.status === "cancelled" || o.status === "rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{o.status}</span>
                                                    <span className="text-xs text-gray-400">{new Date(o.created_at || "").toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mb-1">{o.phone} {o.alternate_mobile ? `/ ${o.alternate_mobile}` : ""}</p>
                                                <p className="text-sm text-gray-500 mb-3">{o.address}, {o.district}, {o.state} - {o.pincode}</p>
                                                <div className="bg-gray-50 rounded-xl p-3 space-y-1 mb-3">
                                                    {o.items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                                                            <span>{item.quantity}x {item.name}</span>
                                                            <span className="font-medium">₹{parseInt(item.price) * item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    {o._type === "order" && (
                                                        <>
                                                            <div className="flex justify-between text-xs text-gray-500 pt-1.5 mt-1.5 border-t border-dashed border-gray-200">
                                                                <span>Subtotal</span><span>₹{o.subtotal}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs text-gray-500">
                                                                <span>Shipping ({o.shipping_region})</span><span>₹{o.shipping}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="flex justify-between text-sm font-bold text-charcoal pt-1.5 mt-1.5 border-t border-dashed border-gray-200">
                                                        <span>Total</span><span>₹{o.total}</span>
                                                    </div>
                                                </div>
                                                {o._type === "birthday" && o.proof_url && (
                                                    <div className="mb-3">
                                                        {signedProofUrls[o.id] ? (
                                                            <a href={signedProofUrls[o.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                                                View Proof
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">Proof image</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex gap-3">
                                                    {o._type === "order" && o.status === "pending" && (
                                                        <>
                                                            <button onClick={() => updateOrderStatus(o.id, "confirmed")} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold">Confirm</button>
                                                            <button onClick={() => updateOrderStatus(o.id, "cancelled")} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold">Cancel</button>
                                                        </>
                                                    )}
                                                    {o._type === "order" && o.status === "confirmed" && (
                                                        <button onClick={() => updateOrderStatus(o.id, "shipped")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">Mark Shipped</button>
                                                    )}
                                                    {o._type === "order" && o.status === "shipped" && (
                                                        <button onClick={() => updateOrderStatus(o.id, "delivered")} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold">Mark Delivered</button>
                                                    )}
                                                    {o._type === "birthday" && o.status === "pending" && (
                                                        <>
                                                            <button onClick={() => updateClaimStatus(o.id, "approved")} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold">Approve</button>
                                                            <button onClick={() => updateClaimStatus(o.id, "rejected")} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold">Reject</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => o._type === "order" ? deleteOrder(o.id) : deleteClaim(o as any)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600">Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : activeTab === "birthday" ? (
                        <div className="space-y-6 animate-fade-in">
                            {birthdayClaims.length === 0 ? (
                                <div className="text-center py-24 text-gray-400">
                                    <p className="font-serif text-2xl mb-2">No claims yet</p>
                                    <p className="text-sm">Birthday offer claims from the storefront will show up here.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {birthdayClaims.map(c => (
                                        <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
                                            {c.proof_url && (
                                                <div className="shrink-0 w-full sm:w-32 flex flex-col gap-2">
                                                    {signedProofUrls[c.id] ? (
                                                        <a href={signedProofUrls[c.id]} target="_blank" rel="noreferrer" className="w-full h-32 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 block">
                                                            <img
                                                                src={signedProofUrls[c.id]}
                                                                className="w-full h-full object-cover"
                                                                alt="Proof"
                                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }}
                                                            />
                                                            <div className="hidden w-full h-full flex items-center justify-center text-[0.65rem] text-gray-400 text-center p-2">Can't preview — click to open</div>
                                                        </a>
                                                    ) : (
                                                        <div className="w-full h-32 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[0.65rem] text-gray-400">Loading proof...</div>
                                                    )}
                                                    <button onClick={() => deleteClaimProof(c)} className="text-[0.65rem] font-bold text-red-500 hover:underline">Delete Proof</button>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <h3 className="font-bold text-charcoal">{c.name}</h3>
                                                    <span className={`text-[0.65rem] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${c.status === "approved" ? "bg-green-100 text-green-700" : c.status === "rejected" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{c.status}</span>
                                                    <span className="text-xs text-gray-400">DOB: {c.date_of_birth}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mb-1">{c.phone} {c.alternate_mobile ? `/ ${c.alternate_mobile}` : ""}</p>
                                                <p className="text-sm text-gray-500 mb-3">{c.address}, {c.district}, {c.state} - {c.pincode}</p>
                                                <div className="bg-gray-50 rounded-xl p-3 space-y-1 mb-3">
                                                    {c.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                                                            <span>{item.quantity}x {item.name}</span>
                                                            <span className="font-medium">₹{parseInt(item.price) * item.quantity}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between text-sm font-bold text-charcoal pt-1.5 mt-1.5 border-t border-dashed border-gray-200">
                                                        <span>Total</span><span>₹{c.total}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    {c.status === "pending" && (
                                                        <>
                                                            <button onClick={() => updateClaimStatus(c.id, "approved")} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold">Approve</button>
                                                            <button onClick={() => updateClaimStatus(c.id, "rejected")} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold">Reject</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => deleteClaim(c)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600">Delete Order</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </main>

            {/* ─── Product Modal ─── */}
            {productModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <h2 className="text-lg sm:text-xl font-serif font-bold text-charcoal">{productModal === "new" ? "Add Product" : "Edit Product"}</h2>
                            <button onClick={() => setProductModal(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 bg-white rounded-full border border-gray-200"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                        </div>

                        <div className="p-4 sm:p-8 overflow-y-auto flex-1 grid md:grid-cols-5 gap-6 sm:gap-8">
                            <div className="md:col-span-2 space-y-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Product Image (4:3)</label>
                                <div onClick={() => fileInputRef.current?.click()} className="aspect-[4/3] w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer overflow-hidden relative group">
                                    {pForm.image_url ? <img src={pForm.image_url} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"><span className="text-xs font-medium">Click to upload</span></div>}
                                </div>
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) { const r = new FileReader(); r.onload = () => setCropFile(r.result as string); r.readAsDataURL(e.target.files[0]); } }} />
                            </div>
                            <div className="md:col-span-3 space-y-4 sm:space-y-5">
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Name</label><input type="text" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category</label><select value={pForm.category} onChange={e => setPForm({ ...pForm, category: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none bg-white">{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Price (₹)</label><input type="number" value={pForm.price} onChange={e => setPForm({ ...pForm, price: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Weight</label><input type="text" value={pForm.weight} onChange={e => setPForm({ ...pForm, weight: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                                    <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Order</label><input type="number" value={pForm.display_order} onChange={e => setPForm({ ...pForm, display_order: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label><textarea rows={3} value={pForm.description} onChange={e => setPForm({ ...pForm, description: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none resize-none" /></div>
                                <label className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer"><input type="checkbox" checked={pForm.featured} onChange={e => setPForm({ ...pForm, featured: e.target.checked })} className="w-5 h-5 accent-paprish-500" /> <div className="text-sm font-bold text-charcoal">Mark as Bestseller</div></label>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 sm:gap-4 shrink-0">
                            <button onClick={() => setProductModal(null)} className="flex-1 py-3 sm:py-3.5 bg-white border border-gray-200 text-charcoal rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={saveProduct} disabled={saving || !pForm.name} className="flex-1 py-3 sm:py-3.5 bg-paprish-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Crop Overlay Modal (for products) ─── */}
            {cropFile && (
                <div className="fixed inset-0 z-[70] flex flex-col bg-charcoal">
                    <div className="flex-1 relative"><Cropper image={cropFile} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} /></div>
                    <div className="bg-white shrink-0 p-4 sm:px-8 sm:py-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] relative z-10 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="hidden sm:block">
                            <h3 className="font-bold text-charcoal">Adjust Image</h3>
                            <p className="text-xs text-gray-500">Drag and zoom to fit.</p>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-64">
                            <span className="text-xs font-bold text-gray-400">ZOOM</span>
                            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-paprish-500" />
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => setCropFile(null)} className="flex-1 sm:flex-none px-6 py-3 font-bold text-sm text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={handleCropAndUpload} disabled={saving} className="flex-1 sm:flex-none px-8 py-3 bg-charcoal text-white rounded-xl font-bold text-sm shadow-lg">Crop</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Review Modal ─── */}
            {reviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl relative">
                        <button onClick={() => setReviewModal(null)} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-charcoal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                        <h2 className="text-lg sm:text-xl font-serif font-bold text-charcoal mb-4 sm:mb-6">{reviewModal === "new" ? "Add Review" : "Edit Review"}</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Name</label><input type="text" value={rForm.name} onChange={e => setRForm({ ...rForm, name: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Location</label><input type="text" value={rForm.location} onChange={e => setRForm({ ...rForm, location: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Source</label><select value={rForm.source} onChange={e => setRForm({ ...rForm, source: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none bg-white"><option value="WhatsApp">WhatsApp</option><option value="Instagram">Instagram</option><option value="Website">Website</option></select></div>
                                <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rating</label><input type="number" min="1" max="5" value={rForm.rating} onChange={e => setRForm({ ...rForm, rating: parseInt(e.target.value) || 5 })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" /></div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quote</label><textarea rows={3} value={rForm.quote} onChange={e => setRForm({ ...rForm, quote: e.target.value })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none resize-none" /></div>
                            <label className="flex items-center gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer"><input type="checkbox" checked={rForm.is_approved} onChange={e => setRForm({ ...rForm, is_approved: e.target.checked })} className="w-5 h-5 accent-paprish-500" /> <span className="text-sm font-bold text-charcoal">Visible</span></label>
                            <button onClick={saveReview} disabled={saving} className="w-full py-3.5 sm:py-4 mt-2 bg-charcoal text-white rounded-xl font-bold text-sm">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Banner Modal ─── */}
            {bannerModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-charcoal/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <h2 className="text-lg sm:text-xl font-serif font-bold text-charcoal">{bannerModal === "new" ? "Add Banner" : "Edit Banner"}</h2>
                            <button onClick={() => setBannerModal(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 bg-white rounded-full border border-gray-200"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-4 sm:p-8 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Banner Image (16:9)</label>
                                <div onClick={() => bannerFileInputRef.current?.click()} className="aspect-[16/9] w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer overflow-hidden relative group">
                                    {bForm.image_url ? <img src={bForm.image_url} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"><span className="text-xs font-medium">Click to upload</span></div>}
                                </div>
                                <input type="file" accept="image/*" className="hidden" ref={bannerFileInputRef} onChange={(e) => { if (e.target.files?.[0]) { const r = new FileReader(); r.onload = () => setBannerCropFile(r.result as string); r.readAsDataURL(e.target.files[0]); } }} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Display Order</label>
                                <input type="number" value={bForm.display_order} onChange={e => setBForm({ ...bForm, display_order: parseInt(e.target.value) || 0 })} className="w-full border border-gray-200 p-3 sm:p-3.5 rounded-xl text-sm outline-none" />
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 sm:gap-4 shrink-0">
                            <button onClick={() => setBannerModal(null)} className="flex-1 py-3 sm:py-3.5 bg-white border border-gray-200 text-charcoal rounded-xl font-bold text-sm">Cancel</button>
                            <button onClick={saveBanner} disabled={saving || !bForm.image_url} className="flex-1 py-3 sm:py-3.5 bg-paprish-500 text-white rounded-xl font-bold text-sm disabled:opacity-50">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Banner Crop Overlay ─── */}
            {bannerCropFile && (
                <div className="fixed inset-0 z-[70] flex flex-col bg-charcoal">
                    <div className="flex-1 relative"><Cropper image={bannerCropFile} crop={bannerCrop} zoom={bannerZoom} aspect={16 / 9} onCropChange={setBannerCrop} onCropComplete={onBannerCropComplete} onZoomChange={setBannerZoom} /></div>
                    <div className="bg-white shrink-0 p-4 sm:px-8 sm:py-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] relative z-10 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="hidden sm:block">
                            <h3 className="font-bold text-charcoal">Adjust Banner Image</h3>
                            <p className="text-xs text-gray-500">Drag and zoom to fit 16:9.</p>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-64">
                            <span className="text-xs font-bold text-gray-400">ZOOM</span>
                            <input type="range" value={bannerZoom} min={1} max={3} step={0.1} onChange={(e) => setBannerZoom(Number(e.target.value))} className="w-full accent-paprish-500" />
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button onClick={() => setBannerCropFile(null)} className="flex-1 sm:flex-none px-6 py-3 font-bold text-sm text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={handleBannerCropAndUpload} disabled={saving} className="flex-1 sm:flex-none px-8 py-3 bg-charcoal text-white rounded-xl font-bold text-sm shadow-lg">Crop & Upload</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}