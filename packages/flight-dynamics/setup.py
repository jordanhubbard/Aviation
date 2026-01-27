from setuptools import find_packages, setup

setup(
    name="aviation-flight-dynamics",
    version="0.1.0",
    description="Physics-based flight simulation library for aviation applications",
    packages=find_packages(),
    package_data={"aviation_flight_dynamics": ["aircraft/models/*.yaml"]},
    include_package_data=True,
    python_requires=">=3.11",
)
