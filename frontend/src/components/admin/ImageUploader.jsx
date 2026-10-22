import { useState, useEffect } from 'react';
import { packagesApi } from '../../api/api';

/**
 * ImageUploader Component
 * 
 * Admin component for uploading and managing package gallery images.
 * Features:
 * - Multi-file upload with drag & drop
 * - Image preview before upload
 * - Caption and display order configuration
 * - Delete existing images
 * - Image type selection (primary/gallery/thumbnail)
 */
export default function ImageUploader({ packageId, onUploadComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch existing images when component mounts
  useEffect(() => {
    fetchExistingImages();
  }, [packageId]);

  async function fetchExistingImages() {
    if (!packageId) return;
    
    setLoading(true);
    try {
      const data = await packagesApi.images.list(packageId);
      setExistingImages(data.images || []);
    } catch (err) {
      console.error('Failed to fetch images:', err);
      setError('Failed to load existing images');
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }

  function processFiles(files) {
    // Validate file types
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Only JPEG, PNG, and WebP are allowed.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 5MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Create preview URLs
    const newPreviews = validFiles.map(file => {
      return {
        file,
        url: URL.createObjectURL(file),
        caption: '',
        imageType: 'gallery',
        displayOrder: existingImages.length + selectedFiles.length + previews.length + 1
      };
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
  }

  function removePreview(index) {
    setPreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].url);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
    
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  }

  function updatePreviewMetadata(index, field, value) {
    setPreviews(prev => {
      const newPreviews = [...prev];
      newPreviews[index][field] = value;
      return newPreviews;
    });
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('package_id', packageId);

      // Add all files
      selectedFiles.forEach((file, index) => {
        formData.append('images[]', file);
        formData.append(`caption_${index}`, previews[index].caption || '');
        formData.append(`display_order_${index}`, previews[index].displayOrder);
      });

      // Get image type from first preview (or make it per-image)
      formData.append('image_type', previews[0]?.imageType || 'gallery');

      const data = await packagesApi.images.upload(formData);

      alert(`Successfully uploaded ${data.count} image(s)`);
      
      // Clean up
      previews.forEach(p => URL.revokeObjectURL(p.url));
      setSelectedFiles([]);
      setPreviews([]);
      
      // Refresh existing images
      await fetchExistingImages();
      
      if (onUploadComplete) {
        onUploadComplete(data.uploaded);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await packagesApi.images.delete(imageId);

      // Remove from local state
      setExistingImages(prev => prev.filter(img => img.image_id !== imageId));
      
      alert('Image deleted successfully');
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.message || 'Failed to delete image');
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="image-uploader">
      <h3>Package Image Gallery</h3>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Existing Images Section */}
      {existingImages.length > 0 && (
        <div className="existing-images mb-4">
          <h4>Current Images ({existingImages.length})</h4>
          <div className="image-grid">
            {existingImages.map(img => (
              <div key={img.image_id} className="image-card">
                <img 
                  src={`http://localhost/travelease${img.image_url}`} 
                  alt={img.caption || 'Package image'} 
                  className="img-thumbnail"
                />
                <div className="image-info">
                  <small className="text-muted">
                    Order: {img.display_order} | Type: {img.image_type}
                  </small>
                  {img.caption && <p className="mb-1">{img.caption}</p>}
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteImage(img.image_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Area */}
      <div
        className="upload-dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          marginBottom: '20px'
        }}
      >
        <p>Drag & drop images here, or click to select</p>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input" className="btn btn-primary">
          Select Images
        </label>
        <p className="text-muted mt-2">
          <small>Supported formats: JPEG, PNG, WebP (max 5MB each)</small>
        </p>
      </div>

      {/* Preview Section */}
      {previews.length > 0 && (
        <div className="preview-section">
          <h4>Selected Images ({previews.length})</h4>
          <div className="image-grid">
            {previews.map((preview, index) => (
              <div key={index} className="preview-card">
                <img src={preview.url} alt="Preview" className="img-thumbnail" />
                <div className="preview-controls">
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    className="form-control form-control-sm mb-2"
                    value={preview.caption}
                    onChange={(e) => updatePreviewMetadata(index, 'caption', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Display order"
                    className="form-control form-control-sm mb-2"
                    value={preview.displayOrder}
                    onChange={(e) => updatePreviewMetadata(index, 'displayOrder', parseInt(e.target.value))}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removePreview(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-success mt-3"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : `Upload ${previews.length} Image(s)`}
          </button>
        </div>
      )}

      <style jsx>{`
        .image-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .image-card,
        .preview-card {
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
          background: white;
        }

        .image-card img,
        .preview-card img {
          width: 100%;
          height: 150px;
          object-fit: cover;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .image-info,
        .preview-controls {
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}
