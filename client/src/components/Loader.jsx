import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const Loader = () => {
  const navigate = useNavigate();
  const { nextUrl } = useParams();

  useEffect(() => {
    if (nextUrl) {
      setTimeout(() => {
        navigate(`/${nextUrl}`);
      }, 4000); // 4 seconds
    }
  }, [nextUrl, navigate]);

  return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-24 w-24 border-4 border-gray-300 border-t-primary"></div>
    </div>
  );
};

export default Loader;
