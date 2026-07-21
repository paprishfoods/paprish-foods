import { useState, useMemo, useEffect, type FormEvent } from "react";
import Select from "react-select";
import { useCart } from "@/context/CartContext";
import { INDIA_LOCATIONS } from "@/data/indiaLocations";
import { supabase } from "@/lib/supabase";

const MIN_ITEMS = 3;
const WHATSAPP_NUMBER = "918531934020";

type Stage = "closed" | "greeting" | "form" | "success";

type CustomerDetails = {
  name: string;
  phone: string;
  address: string;
  district: string;
  state: string;
  pincode: string;
  alternateMobile: string;
  dob: string;
};

const initialDetails: CustomerDetails = {
  name: "",
  phone: "",
  address: "",
  district: "",
  state: "",
  pincode: "",
  alternateMobile: "",
  dob: "",
};

const stateOptions = Object.keys(INDIA_LOCATIONS).map((state) => ({ value: state, label: state }));

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    borderRadius: "0.75rem",
    minHeight: "46px",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(221, 160, 90, 0.2)" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    borderColor: state.isFocused ? "#dda05a" : "#e5e7eb",
    fontSize: "0.875rem",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? "#DD1F1F" : state.isFocused ? "#faf1e0" : "white",
    color: state.isSelected ? "white" : "#1e1e1e",
    fontSize: "0.875rem",
    cursor: "pointer",
  }),
  menu: (base: any) => ({ ...base, borderRadius: "0.75rem", overflow: "hidden", zIndex: 9999 }),
};

function isSameDayAndMonth(isoDate: string) {
  if (!isoDate) return false;
  const dob = new Date(isoDate + "T00:00:00");
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
}

export default function BirthdayOffer() {
  const { items, total, clearCart } = useCart();
  const [stage, setStage] = useState<Stage>("closed");
  const [details, setDetails] = useState<CustomerDetails>(initialDetails);
  const [manualLocation, setManualLocation] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueCount = items.length;
  const eligible = uniqueCount >= MIN_ITEMS;
  const isBirthdayToday = useMemo(() => isSameDayAndMonth(details.dob), [details.dob]);

  const districtOptions = useMemo(() => {
    if (!details.state || !INDIA_LOCATIONS[details.state]) return [];
    return INDIA_LOCATIONS[details.state].map((d) => ({ value: d, label: d }));
  }, [details.state]);

  function update(field: keyof CustomerDetails, value: string) {
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  function openOffer() {
    setError(null);
    setStage(eligible ? "form" : "greeting");
  }

  useEffect(() => {
    function handleExternalOpen() { openOffer(); }
    window.addEventListener("open-birthday-offer", handleExternalOpen);
    return () => window.removeEventListener("open-birthday-offer", handleExternalOpen);
  }, [eligible]);

  function goToProducts() {
    setStage("closed");
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!eligible) {
      setError(`Please select at least ${MIN_ITEMS} products to claim this offer.`);
      return;
    }
    if (!details.state || !details.district) {
      setError("Please provide both your State and District.");
      return;
    }
    if (!details.dob) {
      setError("Please enter your date of birth.");
      return;
    }
    if (!isBirthdayToday) {
      setError("This offer can only be claimed on your birthday. Please come back on your special day! 🎂");
      return;
    }
    if (!proofFile) {
      setError("Since today is your birthday, please upload a proof of ID so we can verify and process your offer.");
      return;
    }

    setSubmitting(true);
    try {
      let proofUrl: string | null = null;
      const fileExt = proofFile.name.split(".").pop() || "jpg";
      const fileName = `proof-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("birthday-proofs")
        .upload(fileName, proofFile, { upsert: true });

      if (uploadError) {
        setError("Could not upload your proof: " + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("birthday-proofs").getPublicUrl(fileName);
      proofUrl = urlData.publicUrl;

      const claimItems = items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price }));

      const { error: insertError } = await supabase.from("birthday_claims").insert({
        name: details.name,
        phone: details.phone,
        address: details.address,
        district: details.district,
        state: details.state,
        pincode: details.pincode,
        alternate_mobile: details.alternateMobile || null,
        date_of_birth: details.dob,
        items: claimItems,
        total,
        proof_url: proofUrl,
        status: "pending",
      });

      if (insertError) {
        setError("Could not submit your claim: " + insertError.message);
        setSubmitting(false);
        return;
      }

      // Send order details to WhatsApp — proof image is NOT included here,
      // it is only visible in the admin panel.
      const lines = items
        .map((item, i) => `${i + 1}. ${item.name} \u00d7 ${item.quantity} \u2014 \u20B9${parseInt(item.price) * item.quantity}`)
        .join("\n");

      const message =
        `🎂 *Birthday Offer Claim!*\n\nHello Paprish Foods! I'd like to claim my birthday offer.\n\n${lines}\n\n*Customer Details*\nName: ${details.name}\nPhone: ${details.phone}\nAddress: ${details.address}\nDistrict: ${details.district}\nState: ${details.state}\nPincode: ${details.pincode}\nAlternate Mobile: ${details.alternateMobile || "Not provided"}\nDate of Birth: ${details.dob}\n\n🧾 *Order Total: ₹${total}*\n\nProof of ID has been shared with the admin panel for verification. Please confirm my offer. Thank you!`;

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");

      clearCart();
      setDetails(initialDetails);
      setProofFile(null);
      setStage("success");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <>
      {/* Floating Claim button — stays at the bottom, greyed out until 3+ products selected */}
      <button
        onClick={openOffer}
        className={`fixed bottom-6 left-6 z-30 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-xl transition-all duration-300 font-semibold text-sm ${eligible
            ? "bg-crimson-700 text-white shadow-crimson-700/30 hover:bg-crimson-800 hover:scale-105"
            : "bg-gray-200 text-gray-500 shadow-gray-300/40"
          }`}
      >
        <span className="text-lg leading-none">🎂</span>
        <span>Claim Offer</span>
        <span
          className={`ml-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${eligible ? "bg-white/20" : "bg-gray-300 text-gray-600"
            }`}
        >
          {Math.min(uniqueCount, MIN_ITEMS)}/{MIN_ITEMS}
        </span>
      </button>

      {/* Greeting popup */}
      {stage === "greeting" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative text-center">
            <button
              onClick={() => setStage("closed")}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-charcoal hover:bg-gray-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="text-5xl mb-4">🎉🎂🎉</div>
            <h2 className="font-serif text-2xl font-bold text-charcoal mb-2">Birthday Wishes from Paprish!</h2>
            <p className="text-charcoal-muted/70 text-sm leading-relaxed mb-6">
              To celebrate your special day with you, we'd love to send you a little treat. Select at least{" "}
              <span className="font-semibold text-crimson-700">{MIN_ITEMS} products</span> from our range to claim
              your birthday offer.
            </p>
            <button
              onClick={goToProducts}
              className="w-full bg-crimson-700 hover:bg-crimson-800 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-crimson-700/20"
            >
              Browse Products
            </button>
          </div>
        </div>
      )}

      {/* Claim form */}
      {stage === "form" && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-charcoal/70 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-6 py-5 border-b border-charcoal/5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="font-serif text-xl font-bold text-charcoal">🎂 Claim Your Birthday Offer</h2>
                <p className="text-xs text-charcoal-muted/50 mt-0.5">{uniqueCount} products selected</p>
              </div>
              <button
                type="button"
                onClick={() => setStage("closed")}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-charcoal hover:bg-gray-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              <div className="bg-paprish-50/60 rounded-xl p-4 space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-charcoal-muted/80">
                    <span className="truncate mr-2">{item.quantity}x {item.name}</span>
                    <span className="shrink-0 font-medium">₹{parseInt(item.price) * item.quantity}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-charcoal pt-2 mt-2 border-t border-dashed border-paprish-200">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5">Full Name</label>
                  <input
                    required
                    type="text"
                    value={details.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5">Phone Number</label>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={details.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5">Detailed Address</label>
                  <textarea
                    required
                    rows={2}
                    value={details.address}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Shop Name/House no., Street, Area"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20 resize-none"
                  />
                </div>

                {!manualLocation ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="relative z-30">
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">State</label>
                      <Select
                        options={stateOptions}
                        value={stateOptions.find((o) => o.value === details.state) || null}
                        onChange={(opt) => { update("state", opt ? opt.value : ""); update("district", ""); }}
                        placeholder="Search state..."
                        isSearchable
                        styles={selectStyles}
                      />
                    </div>
                    <div className="relative z-20">
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">District</label>
                      <Select
                        options={districtOptions}
                        value={districtOptions.find((o) => o.value === details.district) || null}
                        onChange={(opt) => update("district", opt ? opt.value : "")}
                        placeholder={details.state ? "Search district..." : "Select state first"}
                        isSearchable
                        isDisabled={!details.state}
                        styles={selectStyles}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setManualLocation(true); update("state", ""); update("district", ""); }}
                      className="text-xs text-crimson-700 font-medium underline underline-offset-2 text-left"
                    >
                      Can't find your state/district code? Enter it manually
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">State (type manually)</label>
                      <input
                        required
                        type="text"
                        value={details.state}
                        onChange={(e) => update("state", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-charcoal mb-1.5">District (type manually)</label>
                      <input
                        required
                        type="text"
                        value={details.district}
                        onChange={(e) => update("district", e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualLocation(false)}
                      className="text-xs text-crimson-700 font-medium underline underline-offset-2 text-left"
                    >
                      Use the searchable list instead
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">Pincode</label>
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      title="Enter a 6 digit pincode"
                      value={details.pincode}
                      onChange={(e) => update("pincode", e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">Alternate Mobile</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={details.alternateMobile}
                      onChange={(e) => update("alternateMobile", e.target.value)}
                      placeholder="(Optional)"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1.5">Date of Birth</label>
                  <input
                    required
                    type="date"
                    value={details.dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => update("dob", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-paprish-400 focus:ring-2 focus:ring-paprish-400/20"
                  />
                </div>

                {details.dob && !isBirthdayToday && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3">
                    This offer can only be claimed on your actual birthday. Come back on that day and your selection will be saved in your cart!
                  </div>
                )}

                {isBirthdayToday && (
                  <div>
                    <label className="block text-xs font-semibold text-charcoal mb-1.5">
                      🎉 It's your birthday today! Upload a proof of ID for verification
                    </label>
                    <input
                      required
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      className="w-full text-xs px-4 py-3 rounded-xl bg-white border border-gray-200 outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-crimson-700 file:text-white"
                    />
                    <p className="text-[0.65rem] text-charcoal-muted/50 mt-1.5">
                      This proof is shared with our admin team only for verification and is never sent over WhatsApp.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3">{error}</div>
              )}
            </div>

            <div className="shrink-0 border-t border-charcoal/5 px-6 py-5 bg-white">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-crimson-700 hover:bg-crimson-800 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-crimson-700/20"
              >
                {submitting ? "Submitting..." : "Claim My Birthday Offer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success */}
      {stage === "success" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-charcoal/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative text-center">
            <div className="text-5xl mb-4">🎁</div>
            <h2 className="font-serif text-2xl font-bold text-charcoal mb-2">Offer Claimed!</h2>
            <p className="text-charcoal-muted/70 text-sm leading-relaxed mb-6">
              Happy Birthday once again! Our team has received your order and proof for verification and will
              confirm with you shortly on WhatsApp.
            </p>
            <button
              onClick={() => setStage("closed")}
              className="w-full bg-crimson-700 hover:bg-crimson-800 text-white font-semibold py-4 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}